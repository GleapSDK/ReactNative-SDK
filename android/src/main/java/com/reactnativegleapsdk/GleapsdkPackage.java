package com.reactnativegleapsdk;

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class GleapsdkPackage extends TurboReactPackage {

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new GleapsdkModule(reactContext));
        return modules;
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();  // If you don't have view managers, this is correct
    }

    // TurboModules support
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (GleapsdkModule.NAME.equals(name)) {
            return new GleapsdkModule(reactContext);  // Automatically handled for both architectures
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            final ReactModuleInfo gleapModuleInfo = new ReactModuleInfo(
                GleapsdkModule.NAME,           // Module name
                "GleapsdkModule",              // Java class name
                false,                         // canOverrideExistingModule
                false,                         // needsEagerInit (set to false unless necessary)
                true,                          // hasConstants
                false,                         // isCxxModule
                true                           // isTurboModule
            );
            return Collections.singletonMap(GleapsdkModule.NAME, gleapModuleInfo);
        };
    }
}
