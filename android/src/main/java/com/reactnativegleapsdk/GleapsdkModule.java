package com.reactnativegleapsdk;

import android.app.Activity;
import android.os.Handler;

import androidx.annotation.NonNull;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import io.gleap.APPLICATIONTYPE;
import io.gleap.BugWillBeSentCallback;
import io.gleap.Gleap;
import io.gleap.GleapActivationMethod;
import io.gleap.GleapSentCallback;

@ReactModule(name = GleapsdkModule.NAME)
public class GleapsdkModule extends ReactContextBaseJavaModule {
  public static final String NAME = "GleapSdk";

  public GleapsdkModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }


  @ReactMethod
  public void initialize(String sdkKey) {
    try {
      Activity activity = getReactApplicationContext()
        .getCurrentActivity();
      if (activity != null) {
        Gleap.getInstance().setApplicationType(APPLICATIONTYPE.REACTNATIVE);
        Gleap.getInstance().setBugWillBeSentCallback(new BugWillBeSentCallback() {
          @Override
          public void flowInvoced() {
            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("bugWillBeSent", null);
          }
        });
        Gleap.initialize(sdkKey, activity.getApplication());
        Gleap.getInstance().setBugSentCallback(new GleapSentCallback() {
          @Override
          public void close() {
            new java.util.Timer().schedule(
              new java.util.TimerTask() {
                @Override
                public void run() {
                  showDevMenu();
                }
              },
              500
            );
          }
        });
      }
    } catch (Exception ex) {
    }
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void startFeedbackFlow() {
    try {
      Gleap.getInstance().startFeedbackFlow();
      Gleap.getInstance().setBugSentCallback(new GleapSentCallback() {
        @Override
        public void close() {
          new java.util.Timer().schedule(
            new java.util.TimerTask() {
              @Override
              public void run() {
                showDevMenu();
              }
            },
            500
          );
        }
      });
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Show dev menu after shaking the phone.
   */
  private void showDevMenu() {
    final ReactApplication application = (ReactApplication) getReactApplicationContext()
      .getCurrentActivity()
      .getApplication();
    Handler mainHandler = new Handler(this.getReactApplicationContext().getMainLooper());
    Runnable myRunnable = new Runnable() {
      @Override
      public void run() {
        try {
          application
            .getReactNativeHost()
            .getReactInstanceManager()
            .getDevSupportManager()
            .showDevOptionsDialog();
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
    };
    mainHandler.post(myRunnable);
  }
}
