<template>
  <div class="settings-modal-content modal-content">
    <companion-mode-settings />
    <theme-gamut-picker />
    <gfx-icons-settings />
    <item-thumbnails-settings />
    <journey-settings />
    <home-map-settings />
    <gfx-fonts-settings />
    <display-controls :teleport="false" />
    <performance-settings />
  </div>
</template>

<script setup lang="ts">
import { DisplayControls } from '@/shared/ui';
import ThemeGamutPicker from '../theme-gamut-picker/ThemeGamutPicker.vue';
import CompanionModeSettings from '../companion-mode-settings/CompanionModeSettings.vue';
import GfxIconsSettings from '../gfx-icons-settings/GfxIconsSettings.vue';
import ItemThumbnailsSettings from '../item-thumbnails-settings/ItemThumbnailsSettings.vue';
import GfxFontsSettings from '../gfx-fonts-settings/GfxFontsSettings.vue';
import JourneySettings from '../journey-settings/JourneySettings.vue';
import HomeMapSettings from '../home-map-settings/HomeMapSettings.vue';
import PerformanceSettings from '../performance-settings/PerformanceSettings.vue';
</script>
