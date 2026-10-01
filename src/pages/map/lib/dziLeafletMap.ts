/**
 * Deep-zoom map on Leaflet. Panning and pinching move one composited layer
 * with a CSS transform (no per-frame repaint), which is what keeps the map
 * smooth on the handheld while the game uses the GPU. The marker SVG lives
 * in the same transformed pane, so it moves with the map at no JS cost.
 *
 * Coordinates: "image px" are pixels of the full-resolution map image.
 * Leaflet zoom z equals DZI level z, so at the deepest level one image pixel
 * is one CSS pixel.
 */
import L from 'leaflet';
import type { DziInfo } from './types';

export interface DziCrop {
  cropX: number;
  cropYTop: number;
  cropYBottom: number;
}

export interface DziMapOptions {
  info: DziInfo;
  crop: DziCrop;
  /** Real tile URL → cached blob URL (or the same URL). */
  resolveTileUrl: (url: string) => string;
  /** Deepest zoom as screen pixels per image pixel. */
  maxPixelRatio: number;
  onClick: (imageX: number, imageY: number) => void;
  /** Called after any zoom or move settles; `scale` = CSS px per image px. */
  onViewChange: (scale: number) => void;
  /** A drag, pinch or wheel by the player (not a programmatic move). */
  onUserGesture: () => void;
}

/** Tiles of one DZI pyramid; Leaflet zoom z = DZI level z. */
class DziTileLayer extends L.GridLayer {
  constructor(
    private readonly dzi: DziInfo,
    private readonly maxLevel: number,
    private readonly resolve: (url: string) => string,
    options: L.GridLayerOptions,
  ) {
    super(options);
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const { tileSize, overlap, format, tilesBase, width, height } = this.dzi;
    const tile = document.createElement('div');
    tile.style.overflow = 'hidden';
    const levelScale = 2 ** (this.maxLevel - coords.z);
    const cols = Math.ceil(width / levelScale / tileSize);
    const rows = Math.ceil(height / levelScale / tileSize);
    if (coords.x < 0 || coords.y < 0 || coords.x >= cols || coords.y >= rows) {
      queueMicrotask(() => done(undefined, tile));
      return tile;
    }
    // DZI tiles carry `overlap` extra pixels on inner edges: shift the
    // image so the tile's own area starts at the div's corner.
    const img = document.createElement('img');
    img.decoding = 'async';
    img.alt = '';
    img.draggable = false;
    img.style.position = 'absolute';
    img.style.left = `${coords.x > 0 ? -overlap : 0}px`;
    img.style.top = `${coords.y > 0 ? -overlap : 0}px`;
    img.style.maxWidth = 'none';
    img.onload = () => done(undefined, tile);
    img.onerror = () => done(new Error('tile'), tile);
    img.src = this.resolve(`${tilesBase}/${coords.z}/${coords.x}_${coords.y}.${format}`);
    tile.appendChild(img);
    return tile;
  }
}

/** Number of DZI levels below the full image (level n = full size). */
function maxLevelOf(info: DziInfo): number {
  return Math.ceil(Math.log2(Math.max(info.width, info.height)));
}

export class DziLeafletMap {
  readonly map: L.Map;
  private readonly maxLevel: number;
  /** Map units per image pixel factor: lat/lng = image px / K. */
  private readonly k: number;
  private readonly info: DziInfo;
  private readonly crop: DziCrop;
  private resizeObserver: ResizeObserver | null = null;
  private overlay: L.SVGOverlay | null = null;

  constructor(
    host: HTMLElement,
    private readonly options: DziMapOptions,
  ) {
    this.info = options.info;
    this.crop = options.crop;
    this.maxLevel = maxLevelOf(options.info);
    this.k = 2 ** this.maxLevel;

    const maxZoom = this.maxLevel + Math.log2(Math.max(1, options.maxPixelRatio));
    this.map = L.map(host, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      maxZoom,
      minZoom: 0,
      fadeAnimation: false,
      markerZoomAnimation: false,
      bounceAtZoomLimits: false,
      inertia: true,
      inertiaDeceleration: 2600,
      maxBoundsViscosity: 1,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    const imageBounds = this.imageRectToBounds(0, 0, this.info.width, this.info.height);
    this.map.setMaxBounds(this.croppedBounds());
    this.createTileLayer(imageBounds).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const p = this.toImage(e.latlng);
      options.onClick(p.x, p.y);
    });
    this.map.on('zoomend moveend', () => options.onViewChange(this.scale()));
    this.map.on('dragstart', () => options.onUserGesture());
    const container = this.map.getContainer();
    container.addEventListener('wheel', () => options.onUserGesture(), { passive: true });
    container.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length > 1) options.onUserGesture();
      },
      { passive: true },
    );

    this.updateMinZoom();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.map.invalidateSize({ pan: false });
        this.updateMinZoom();
        options.onViewChange(this.scale());
      });
      this.resizeObserver.observe(host);
    }
  }

  // ─── Coordinates ────────────────────────────────────────────────────────

  toLatLng(x: number, y: number): L.LatLng {
    return L.latLng(-y / this.k, x / this.k);
  }

  toImage(latlng: L.LatLng): { x: number; y: number } {
    return { x: latlng.lng * this.k, y: -latlng.lat * this.k };
  }

  imageRectToBounds(minX: number, minY: number, maxX: number, maxY: number): L.LatLngBounds {
    return L.latLngBounds(this.toLatLng(minX, maxY), this.toLatLng(maxX, minY));
  }

  private croppedBounds(): L.LatLngBounds {
    const { cropX, cropYTop, cropYBottom } = this.crop;
    return this.imageRectToBounds(cropX, cropYTop, this.info.width - cropX, this.info.height - cropYBottom);
  }

  /** CSS pixels per image pixel at the current zoom. */
  scale(): number {
    return 2 ** this.map.getZoom() / this.k;
  }

  /** Zoom at which `scale()` equals the given value. */
  zoomForScale(scale: number): number {
    return Math.log2(scale * this.k);
  }

  /** Scale at which the cropped map covers the whole view. */
  coverScale(): number {
    const size = this.map.getSize();
    const w = this.info.width - 2 * this.crop.cropX;
    const h = this.info.height - this.crop.cropYTop - this.crop.cropYBottom;
    if (!size.x || !size.y || w <= 0 || h <= 0) return 1;
    return Math.max(size.x / w, size.y / h);
  }

  private updateMinZoom(): void {
    const size = this.map.getSize();
    const w = this.info.width - 2 * this.crop.cropX;
    const h = this.info.height - this.crop.cropYTop - this.crop.cropYBottom;
    if (!size.x || !size.y || w <= 0 || h <= 0) return;
    // Allow zooming out until the whole map fits.
    const fit = Math.min(size.x / w, size.y / h);
    this.map.setMinZoom(this.zoomForScale(fit));
  }

  // ─── Tiles ──────────────────────────────────────────────────────────────

  private createTileLayer(bounds: L.LatLngBounds): L.GridLayer {
    const layer = new DziTileLayer(this.info, this.maxLevel, this.options.resolveTileUrl, {
      tileSize: this.info.tileSize,
      bounds,
      minNativeZoom: Math.max(0, this.maxLevel - 6),
      maxNativeZoom: this.maxLevel,
      // Fewer tile swaps mid-gesture; neighbours stay loaded for quick pans.
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 3,
      className: 'dzi-tiles',
    });
    // Let each tile show the DZI overlap pixel on its right and bottom edge:
    // at fractional zoom the tiles then overlap instead of leaving hairline
    // gaps. Leaflet sets the tile size after createTile, so do it here.
    const grown = `${this.info.tileSize + Math.max(1, this.info.overlap)}px`;
    layer.on('tileloadstart', (e: L.TileEvent) => {
      e.tile.style.width = grown;
      e.tile.style.height = grown;
    });
    return layer;
  }

  // ─── Overlay ────────────────────────────────────────────────────────────

  /** Puts the marker SVG (image-px viewBox) into the map's moving pane. */
  attachOverlay(svg: SVGSVGElement): void {
    this.overlay?.remove();
    this.overlay = L.svgOverlay(svg, this.imageRectToBounds(0, 0, this.info.width, this.info.height), {
      interactive: false,
      className: 'map-svg-overlay',
    }).addTo(this.map);
  }

  // ─── View changes ───────────────────────────────────────────────────────

  setView(x: number, y: number, scale: number, animate = false): void {
    this.map.setView(this.toLatLng(x, y), this.zoomForScale(scale), { animate });
  }

  panTo(x: number, y: number, animate = true): void {
    this.map.panTo(this.toLatLng(x, y), { animate, duration: 0.35 });
  }

  fitImageRect(minX: number, minY: number, maxX: number, maxY: number): void {
    this.map.fitBounds(this.imageRectToBounds(minX, minY, maxX, maxY), { animate: false });
  }

  zoomBy(delta: number): void {
    this.map.setZoom(this.map.getZoom() + delta, { animate: true });
  }

  center(): { x: number; y: number } {
    return this.toImage(this.map.getCenter());
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.overlay?.remove();
    this.overlay = null;
    this.map.remove();
  }
}
