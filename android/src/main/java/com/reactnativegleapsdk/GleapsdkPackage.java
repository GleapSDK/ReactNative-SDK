package com.reactnativegleapsdk;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// Import necessary TurboModule classes for the new architecture
import com.facebook.react.turbomodule.core.interfaces.TurboModule;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

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
        return Collections.emptyList();
    }

    // For TurboModules support
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (name.equals(GleapsdkModule.NAME)) {
            return new GleapsdkModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> {
            final ReactModuleInfo gleapModuleInfo = new ReactModuleInfo(
                GleapsdkModule.NAME,
                "GleapsdkModule",
                false, // canOverrideExistingModule
                true,  // needsEagerInit
                true,  // hasConstants
                false, // isCxxModule
                true   // isTurboModule
            );

            return Collections.singletonMap(GleapsdkModule.NAME, gleapModuleInfo);
        };
    }
}
