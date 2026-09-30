package com.andreyvelsk.skyrimwebmonitor;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Companion mode" for dual-screen handhelds (AYN Thor and similar).
 *
 * Android gives the controller to the display the user touched last. A window
 * with FLAG_NOT_FOCUSABLE still receives touches, but a tap on it does not
 * move input focus to its display (WindowManagerService ignores taps on
 * windows that cannot receive keys). So with the flag set, the game on the
 * other screen keeps the controller while the player uses this app.
 *
 * The flag also blocks the soft keyboard, so the web app turns it off while
 * a text field is in use.
 */
@CapacitorPlugin(name = "CompanionMode")
public class CompanionModePlugin extends Plugin {

    @PluginMethod
    public void setPassive(PluginCall call) {
        final boolean passive = Boolean.TRUE.equals(call.getBoolean("passive", true));
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (passive) {
                window.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
            }
            JSObject result = new JSObject();
            result.put("passive", passive);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            int flags = activity.getWindow().getAttributes().flags;
            JSObject result = new JSObject();
            result.put("passive", (flags & WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) != 0);
            call.resolve(result);
        });
    }
}
