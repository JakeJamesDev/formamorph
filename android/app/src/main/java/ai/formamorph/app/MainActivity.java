package ai.formamorph.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor reads the registry while it builds the bridge, so this has to come first.
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
