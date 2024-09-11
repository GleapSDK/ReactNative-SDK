import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class GleapsdkPackage extends TurboReactPackage {  // TurboReactPackage for new architecture

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new GleapsdkModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    // Check for TurboModule support and fallback to old architecture
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (name.equals(GleapsdkModule.NAME)) {
            // Check if TurboModules are enabled
            if (TurboModuleRegistry.getModule(name, reactContext) != null) {
                return TurboModuleRegistry.getModule(name, reactContext);  // For TurboModules
            } else {
                return new GleapsdkModule(reactContext);  // For traditional NativeModules
            }
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            final ReactModuleInfo gleapModuleInfo = new ReactModuleInfo(
                GleapsdkModule.NAME,
                "GleapsdkModule",
                false,  // canOverrideExistingModule
                true,   // needsEagerInit
                true,   // hasConstants
                false,  // isCxxModule
                true    // isTurboModule
            );

            return Collections.singletonMap(GleapsdkModule.NAME, gleapModuleInfo);
        };
    }
}
