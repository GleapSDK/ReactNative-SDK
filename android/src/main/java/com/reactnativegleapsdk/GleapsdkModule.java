package com.reactnativegleapsdk;

import android.app.Activity;
import android.os.Build;
import android.os.Handler;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.gleap.APPLICATIONTYPE;
import io.gleap.GleapSessionProperties;
import io.gleap.SurveyType;
import io.gleap.callbacks.AiToolExecutedCallback;
import io.gleap.callbacks.GleapAgentToolHandler;
import io.gleap.callbacks.GleapAgentToolResultCallback;
import io.gleap.callbacks.GetActivityCallback;
import io.gleap.Gleap;
import io.gleap.GleapActivationMethod;
import io.gleap.GleapLogFlushHandler;
import io.gleap.GleapLogLevel;
import io.gleap.PrefillHelper;
import io.gleap.callbacks.ConfigLoadedCallback;
import io.gleap.callbacks.InitializedCallback;
import io.gleap.callbacks.CustomActionCallback;
import io.gleap.callbacks.FeedbackFlowStartedCallback;
import io.gleap.callbacks.FeedbackSendingFailedCallback;
import io.gleap.callbacks.FeedbackSentCallback;
import io.gleap.callbacks.OutboundSentCallback;
import io.gleap.callbacks.WidgetClosedCallback;
import io.gleap.callbacks.WidgetOpenedCallback;
import io.gleap.callbacks.RegisterPushMessageGroupCallback;
import io.gleap.callbacks.UnRegisterPushMessageGroupCallback;
import io.gleap.callbacks.NotificationUnreadCountUpdatedCallback;

@ReactModule(name = GleapsdkModule.NAME)
public class GleapsdkModule extends ReactContextBaseJavaModule {
  public static final String NAME = "Gleapsdk";
  private boolean isSilentBugReport = false;
  private volatile boolean invalidated = false;
  private final Map<String, GleapAgentToolResultCallback> pendingAgentToolExecutions = new ConcurrentHashMap<>();
  // Capture requests: log flushes the native SDK waits for (at most 500 ms) until JS has handed
  // over the network requests it still holds back, by flush id.
  private final Map<String, Runnable> pendingLogFlushes = new ConcurrentHashMap<>();

  // The native SDK loads its config once per process and fires configLoaded / initialized only
  // then. The JS side (e.g. the Android network logger) depends on configLoaded, so the config
  // is kept for the process and replayed when initialize is called again: after a JS reload
  // (dev reload, OTA update) or when the SDK was already initialized natively.
  @Nullable
  private static volatile String loadedFlowConfig = null;

  public GleapsdkModule(ReactApplicationContext context) {
    super(context);

    Gleap.getInstance().setGetActivityCallback(new GetActivityCallback() {
      @Override
      public Activity getActivity() {
        return context.getCurrentActivity();
      }
    });

    // Registered right away, so a config loaded by a native Gleap.initialize (e.g. in
    // Application.onCreate) before the JS initialize is not missed.
    registerConfigCallbacks();

    try {
      JSONObject body = new JSONObject();
      body.put("page", "MainActivity");
      Gleap.getInstance().trackEvent("pageView", body);
    } catch (Exception ex) {
    }
  }



  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  /**
   * Auto-configures the Gleap SDK from the remote config.
   *
   * @param sdkKey The SDK key, which can be found on dashboard.Gleap.io
   */
  @ReactMethod
  public void initialize(String sdkKey) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Activity activity = getReactApplicationContext()
                .getCurrentActivity();
              if (activity != null && !invalidated) {
                Gleap.getInstance().setApplicationType(APPLICATIONTYPE.REACTNATIVE);
                Gleap.initialize(sdkKey, activity.getApplication());

                try {
                  JSONObject body = new JSONObject();
                  body.put("page", "MainPage");
                  Gleap.getInstance().trackEvent("pageView", body);
                } catch (Exception ignore) {}

                Gleap.getInstance().setWidgetOpenedCallback(new WidgetOpenedCallback() {
                  @Override
                  public void invoke() {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("widgetOpened", null);
                  }
                });

                Gleap.getInstance().setAiToolExecutedCallback(new AiToolExecutedCallback() {
                  @Override
                  public void aiToolExecuted(JSONObject jsonObject) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("toolExecution", jsonObject);
                  }
                });

                Gleap.getInstance().setWidgetClosedCallback(new WidgetClosedCallback() {
                  @Override
                  public void invoke() {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("widgetClosed", null);
                  }
                });

                registerConfigCallbacks();

                Gleap.getInstance().setOutboundSentCallback(new OutboundSentCallback() {
                  @Override
                  public void invoke(JSONObject jsonObject) {
                    try {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("outboundSent", jsonObject.toString());
                    } catch (Exception exp) {}
                  }
                });

                Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
                  @Override
                  public void invoke(JSONObject jsonObject) {
                    try {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("feedbackSent", jsonObject.toString());
                    } catch (Exception exp) {}
                  }
                });

                Gleap.getInstance().setFeedbackSendingFailedCallback(new FeedbackSendingFailedCallback() {
                  @Override
                  public void invoke(String message) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("feedbackSendingFailed", message);
                  }
                });

                Gleap.getInstance().setNotificationUnreadCountUpdatedCallback(new NotificationUnreadCountUpdatedCallback() {
                  @Override
                  public void invoke(int count) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("notificationCountUpdated", count);
                  }
                });

                Gleap.getInstance().registerCustomAction(new CustomActionCallback() {
                  @Override
                  public void invoke(String message, String shareToken) {
                    JSONObject obj = new JSONObject();
                    try {
                      obj.put("name", message);
                      if (shareToken != null) {
                        obj.put("shareToken", shareToken);
                      }
                    } catch (JSONException e) {
                      e.printStackTrace();
                    }
                    if (!invalidated) {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("customActionTriggered", obj.toString());
                    }
                  }
                });

                Gleap.getInstance().setFeedbackFlowStartedCallback(new FeedbackFlowStartedCallback() {
                  @Override
                  public void invoke(String message) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("feedbackFlowStarted", message);
                  }
                });

                Gleap.getInstance().setRegisterPushMessageGroupCallback(new RegisterPushMessageGroupCallback() {
                  @Override
                  public void invoke(String pushMessageGroup) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("registerPushMessageGroup", pushMessageGroup);
                  }
                });

                Gleap.getInstance().setUnRegisterPushMessageGroupCallback(new UnRegisterPushMessageGroupCallback() {
                  @Override
                  public void invoke(String pushMessageGroup) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("unregisterPushMessageGroup", pushMessageGroup);
                  }
                });

                // Already initialized (JS reload, native initialize): the native SDK does not
                // load the config again, so hand the loaded one to this JS context.
                replayLoadedConfig();
              }
            } catch (Exception ex) {
              System.out.println(ex);
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  private void registerConfigCallbacks() {
    try {
      Gleap.getInstance().setConfigLoadedCallback(new ConfigLoadedCallback() {
        @Override
        public void configLoaded(JSONObject jsonObject) {
          String flowConfig = jsonObject != null ? jsonObject.toString() : "{}";
          loadedFlowConfig = flowConfig;
          emitToJs("configLoaded", flowConfig);
        }
      });

      Gleap.getInstance().setInitializedCallback(new InitializedCallback() {
        @Override
        public void initialized() {
          emitToJs("initialized", null);
        }
      });
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Sends the config the native SDK already loaded (configLoaded, then initialized) to JS, like
   * the iOS SDK does when it is initialized again. Does nothing while the config is still
   * loading: the callbacks deliver it. The JS side handles the config once per JS context.
   */
  private void replayLoadedConfig() {
    String flowConfig = loadedFlowConfig;
    if (flowConfig == null) {
      return;
    }
    emitToJs("configLoaded", flowConfig);
    emitToJs("initialized", null);
  }

  private void emitToJs(String eventName, @Nullable Object data) {
    if (invalidated) {
      return;
    }
    try {
      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(eventName, data);
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  @ReactMethod
  public void addListener(String eventName) {
    // Set up any upstream listeners or background tasks as necessary
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    // Remove upstream listeners, stop unnecessary background tasks
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void open() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().open();
            } catch (Exception e) {
              System.out.println(e);
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void isUserIdentified(final Promise promise) {
    Runnable resolveIsUserIdentified = new Runnable() {
      @Override
      public void run() {
        try {
          promise.resolve(Gleap.getInstance().isUserIdentified());
        } catch (Exception ex) {
          promise.resolve(false);
        }
      }
    };

    try {
      getActivitySafe().runOnUiThread(resolveIsUserIdentified);
    } catch (NoUiThreadException e) {
      // No activity (e.g. in the background): answer right away so the promise settles.
      resolveIsUserIdentified.run();
    }
  }

  @ReactMethod
  public void openProtectedFileFromUrl(final String url, final Promise promise) {
    Runnable resolveOpenProtectedFile = new Runnable() {
      @Override
      public void run() {
        try {
          promise.resolve(Gleap.getInstance().openProtectedFileFromUrl(url));
        } catch (Exception ex) {
          promise.resolve(false);
        }
      }
    };

    try {
      getActivitySafe().runOnUiThread(resolveOpenProtectedFile);
    } catch (NoUiThreadException e) {
      // No activity yet: queue the file right away so the promise settles.
      resolveOpenProtectedFile.run();
    }
  }

  @ReactMethod
  public void getIdentity(final Promise promise) {
    Runnable resolveIdentity = new Runnable() {
      @Override
      public void run() {
        try {
          GleapSessionProperties gleapUser = Gleap.getInstance().getIdentity();
          if (gleapUser != null) {
            WritableMap map = new WritableNativeMap();

            map.putString("userId", gleapUser.getUserId());
            map.putString("phone", gleapUser.getPhone());
            map.putString("email", gleapUser.getEmail());
            map.putString("name", gleapUser.getName());
            map.putDouble("value", gleapUser.getValue());
            map.putDouble("sla", gleapUser.getSla());
            map.putString("plan", gleapUser.getPlan());
            map.putString("companyName", gleapUser.getCompanyName());
            map.putString("companyId", gleapUser.getCompanyId());
            map.putString("avatar", gleapUser.getAvatar());

            promise.resolve(map);
          } else {
            promise.resolve(null);
          }
        } catch (Exception ex) {
          promise.resolve(null);
        }
      }
    };

    try {
      getActivitySafe().runOnUiThread(resolveIdentity);
    } catch (NoUiThreadException e) {
      // No activity (e.g. in the background): answer right away so the promise settles.
      resolveIdentity.run();
    }
  }

  @ReactMethod
  public void close() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().close();
            } catch (Exception ex) {
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void isOpened(final Promise promise) {
    Runnable resolveIsOpened = new Runnable() {
      @Override
      public void run() {
        try {
          promise.resolve(Gleap.getInstance().isOpened());
        } catch (Exception ex) {
          promise.resolve(false);
        }
      }
    };

    try {
      getActivitySafe().runOnUiThread(resolveIsOpened);
    } catch (NoUiThreadException e) {
      // No activity (e.g. in the background): answer right away so the promise settles.
      resolveIsOpened.run();
    }
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void showFeedbackButton(boolean show) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().showFeedbackButton(show);
            } catch (Exception e) {
              System.out.println(e);
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void startFeedbackFlow(String feedbackFlow, boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().startFeedbackFlow(feedbackFlow, showBackButton);
            } catch (Exception e) {
              System.out.println(e);
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void startClassicForm(String formId, boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().startClassicForm(formId, showBackButton);
            } catch (Exception e) {
              System.out.println(e);
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  /**
   * Manually start a silent bug reporting workflow.
   */
  @ReactMethod
  public void sendSilentCrashReport(
    String description,
    String priority) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            isSilentBugReport = true;
            Gleap.SEVERITY severity = Gleap.SEVERITY.LOW;
            if ("MEDIUM".equals(priority)) {
              severity = Gleap.SEVERITY.MEDIUM;
            }
            if ("HIGH".equals(priority)) {
              severity = Gleap.SEVERITY.HIGH;
            }
            Gleap.getInstance().sendSilentCrashReport(description, severity);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  /**
   * Manually start a silent bug reporting workflow.
   */
  @ReactMethod
  public void sendSilentCrashReportWithExcludeData(
    String description,
    String priority,
    ReadableMap data) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = new JSONObject();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
            } catch (Exception ex) {
            }

            isSilentBugReport = true;
            Gleap.SEVERITY severity = Gleap.SEVERITY.LOW;
            if ("MEDIUM".equals(priority)) {
              severity = Gleap.SEVERITY.MEDIUM;
            }
            if ("HIGH".equals(priority)) {
              severity = Gleap.SEVERITY.HIGH;
            }
            Gleap.getInstance().sendSilentCrashReport(description, severity, jsonObject);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void preFillForm(
    ReadableMap data) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = new JSONObject();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
            } catch (Exception ex) {
            }
            PrefillHelper.getInstancen().setPrefillData(jsonObject);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void setLanguage(String language) {
    Gleap.getInstance().setLanguage(language);
  }

  @ReactMethod
  public void setNotificationContainerOffset(int x, int y) {
    Gleap.getInstance().setNotificationContainerOffset(x, y);
  }

  @ReactMethod
  public void enableDebugConsoleLog() {

  }

  @ReactMethod
  public void updateContact(ReadableMap data) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = null;
            GleapSessionProperties gleapUserSession = new GleapSessionProperties();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
              if (jsonObject.has("name")) {
                gleapUserSession.setName(jsonObject.getString("name"));
              }
              if (jsonObject.has("email")) {
                gleapUserSession.setEmail(jsonObject.getString("email"));
              }
              if (jsonObject.has("phone")) {
                gleapUserSession.setPhone(jsonObject.getString("phone"));
              }
              if (jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
              }
              if (jsonObject.has("sla")) {
                gleapUserSession.setSla(jsonObject.getDouble("sla"));
              }
              if (jsonObject.has("plan")) {
                gleapUserSession.setPlan(jsonObject.getString("plan"));
              }
              if (jsonObject.has("companyName")) {
                gleapUserSession.setCompanyName(jsonObject.getString("companyName"));
              }
              if (jsonObject.has("companyId")) {
                gleapUserSession.setCompanyId(jsonObject.getString("companyId"));
              }
              if (jsonObject.has("avatar")) {
                gleapUserSession.setAvatar(jsonObject.getString("avatar"));
              }
              if (jsonObject.has("customData")) {
                gleapUserSession.setCustomData(jsonObject.getJSONObject("customData"));
              }
            } catch (JSONException e) {
              e.printStackTrace();
            }

            if (Gleap.getInstance() == null) {
              return;
            }
            Gleap.getInstance().updateContact(gleapUserSession);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void identify(String userid, ReadableMap data) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = null;
            GleapSessionProperties gleapUserSession = new GleapSessionProperties();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
              if (jsonObject.has("name")) {
                gleapUserSession.setName(jsonObject.getString("name"));
              }
              if (jsonObject.has("email")) {
                gleapUserSession.setEmail(jsonObject.getString("email"));
              }
              if (jsonObject.has("phone")) {
                gleapUserSession.setPhone(jsonObject.getString("phone"));
              }
              if (jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
              }
              if (jsonObject.has("sla")) {
                gleapUserSession.setSla(jsonObject.getDouble("sla"));
              }
              if (jsonObject.has("plan")) {
                gleapUserSession.setPlan(jsonObject.getString("plan"));
              }
              if (jsonObject.has("companyName")) {
                gleapUserSession.setCompanyName(jsonObject.getString("companyName"));
              }
              if (jsonObject.has("companyId")) {
                gleapUserSession.setCompanyId(jsonObject.getString("companyId"));
              }
              if (jsonObject.has("avatar")) {
                gleapUserSession.setAvatar(jsonObject.getString("avatar"));
              }
              if (jsonObject.has("customData")) {
                gleapUserSession.setCustomData(jsonObject.getJSONObject("customData"));
              }
            } catch (JSONException e) {
              e.printStackTrace();
            }

            if (Gleap.getInstance() == null) {
              return;
            }
            Gleap.getInstance().identifyUser(userid, gleapUserSession);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void trackPage(String pageName) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              JSONObject body = new JSONObject();
              body.put("page", pageName);
              Gleap.getInstance().trackEvent("pageView", body);
            } catch (Exception ignore) {
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void identifyWithUserHash(String userid, ReadableMap data, String hash) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = null;
            GleapSessionProperties gleapUserSession = new GleapSessionProperties();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
              if (jsonObject.has("name")) {
                gleapUserSession.setName(jsonObject.getString("name"));
              }
              if (jsonObject.has("email")) {
                gleapUserSession.setEmail(jsonObject.getString("email"));
              }
              if (jsonObject.has("phone")) {
                gleapUserSession.setPhone(jsonObject.getString("phone"));
              }
              if (jsonObject.has("plan")) {
                gleapUserSession.setPlan(jsonObject.getString("plan"));
              }
              if (jsonObject.has("companyName")) {
                gleapUserSession.setCompanyName(jsonObject.getString("companyName"));
              }
              if (jsonObject.has("companyId")) {
                gleapUserSession.setCompanyId(jsonObject.getString("companyId"));
              }
              if (jsonObject.has("avatar")) {
                gleapUserSession.setAvatar(jsonObject.getString("avatar"));
              }
              if (jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
              }
              if (jsonObject.has("sla")) {
                gleapUserSession.setSla(jsonObject.getDouble("sla"));
              }
              if (jsonObject.has("customData")) {
                gleapUserSession.setCustomData(jsonObject.getJSONObject("customData"));
              }
            } catch (JSONException e) {
              e.printStackTrace();
            }

            gleapUserSession.setHash(hash);
            if (Gleap.getInstance() == null) {
              return;
            }

            Gleap.getInstance().identifyUser(userid, gleapUserSession);
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void clearIdentity() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().clearIdentity();
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  /**
   * Attaches custom data, which can be viewed in the BugBattle dashboard. New
   * data will be merged with existing custom data.
   *
   * @param customData The data to attach to a bug report.
   * @author BugBattle
   */
  @ReactMethod
  public void attachCustomData(ReadableMap customData) {
    try {
      JSONObject jsonObject = GleapUtil.convertMapToJson(customData);
      if (Gleap.getInstance() == null) {
        return;
      }
      Gleap.getInstance().attachCustomData(jsonObject);
    } catch (Exception e) {
      System.out.println(e);
    }

  }

  /**
   * Sets the data region of your Gleap project. Sets the API url, the websocket
   * url and the realtime host at once. Must be called before initialize. A manual
   * setter (setApiUrl, setWSApiUrl, setRealtimeHost) called after setRegion
   * overrides that single host.
   *
   * @param region "eu" | "us"
   */
  @ReactMethod
  public void setRegion(String region) {
    try {
      Gleap.getInstance().setRegion(region);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Used for dedicated server. Set the url, where bugs are reported to.
   *
   * @param apiUrl Url to the dedicated server.
   */
  @ReactMethod
  public void setApiUrl(String apiUrl) {
    try {
      Gleap.getInstance().setApiUrl(apiUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Used for dedicated server. Set the websocket url.
   *
   * @param wsApiUrl Websocket url of the dedicated server.
   */
  @ReactMethod
  public void setWSApiUrl(String wsApiUrl) {
    try {
      Gleap.getInstance().setWSApiUrl(wsApiUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Used for dedicated server. Set the realtime host.
   *
   * @param realtimeHost Realtime host of the dedicated server.
   */
  @ReactMethod
  public void setRealtimeHost(String realtimeHost) {
    try {
      Gleap.getInstance().setRealtimeHost(realtimeHost);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Frame url
   *
   * @param frameUrl Url to the dedicated server.
   */
  @ReactMethod
  public void setFrameUrl(String frameUrl) {
    try {
      Gleap.getInstance().setFrameUrl(frameUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Banner url
   *
   * @param bannerUrl Url the banner widget is loaded from.
   */
  @ReactMethod
  public void setBannerUrl(String bannerUrl) {
    try {
      Gleap.getInstance().setBannerUrl(bannerUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Modal url
   *
   * @param modalUrl Url the modal widget is loaded from.
   */
  @ReactMethod
  public void setModalUrl(String modalUrl) {
    try {
      Gleap.getInstance().setModalUrl(modalUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Attach one key value pair to existing custom data.
   *
   * @param value The value you want to add
   * @param key   The key of the attribute
   * @author Gleap
   */
  @ReactMethod
  public void setCustomData(String key, String value) {
    Gleap.getInstance().setCustomData(key, value);
  }

  /**
   * Registers the handler for a dashboard-defined Frontend tool. Executions
   * round-trip to JS via the agentToolExecution event and sendAgentToolResult.
   * @param name The tool's runtime name as defined on the AI agent.
   */
  @ReactMethod
  public void registerAgentTool(String name) {
    try {
      Gleap.getInstance().registerAgentTool(name, new GleapAgentToolHandler() {
        @Override
        public void execute(JSONObject params, GleapAgentToolResultCallback callback) {
          try {
            String executionId = UUID.randomUUID().toString();
            pendingAgentToolExecutions.put(executionId, callback);

            JSONObject eventData = new JSONObject();
            eventData.put("executionId", executionId);
            eventData.put("name", name);
            eventData.put("params", params != null ? params : new JSONObject());

            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("agentToolExecution", eventData.toString());
          } catch (Exception e) {
            callback.onResult("Tool execution failed: " + e.getMessage());
          }
        }
      });
    } catch (Exception e) {
      System.out.println("Error registering agent tool: " + e);
    }
  }

  /**
   * Resolves a pending agent tool execution with the handler's result.
   */
  @ReactMethod
  public void sendAgentToolResult(String executionId, String result) {
    try {
      if (executionId == null) {
        return;
      }
      GleapAgentToolResultCallback callback = pendingAgentToolExecutions.remove(executionId);
      if (callback != null) {
        callback.onResult(result);
      }
    } catch (Exception e) {
      System.out.println("Error sending agent tool result: " + e);
    }
  }

  /**
   * Set the value for a ticket attribute with key.
   *
   * @param value The value you want to add
   * @param key   The key of the attribute
   * @author Gleap
   */
  @ReactMethod
  public void setTicketAttribute(String key, String value) {
    Gleap.getInstance().setTicketAttribute(key, value);
  }

  /**
   * Unset the value for a ticket attribute with key.
   *
   * @param key The key of the attribute
   * @author Gleap
   */
  @ReactMethod
  public void unsetTicketAttribute(String key) {
    Gleap.getInstance().unsetTicketAttribute(key);
  }

  /**
   * Clears all ticket attributes.
   *
   * @author Gleap
   */
  @ReactMethod
  public void clearTicketAttributes() {
    Gleap.getInstance().clearTicketAttributes();
  }

  /**
   * Removes one key from existing custom data.
   *
   * @param key The key of the attribute
   * @author Gleap
   */
  @ReactMethod
  public void removeCustomDataForKey(String key) {
    Gleap.getInstance().removeCustomDataForKey(key);
  }

  /**
   * Sets an array of activation methods.
   *
   * @param activationMethods Array of activation methods.
   * @author Gleap
   */
  @ReactMethod
  public void setActivationMethods(ReadableArray activationMethods) {
    ArrayList<GleapActivationMethod> internalActivationMethods = new ArrayList<>();
    for (int i = 0; i < activationMethods.size(); i++) {
      if (activationMethods.getString(i).equalsIgnoreCase("SHAKE")) {
        internalActivationMethods.add(GleapActivationMethod.SHAKE);
      }
      if (activationMethods.getString(i).equalsIgnoreCase("SCREENSHOT")) {
        internalActivationMethods.add(GleapActivationMethod.SCREENSHOT);
      }
    }
    if (Gleap.getInstance() != null) {
      Gleap.getInstance().setActivationMethods(
        internalActivationMethods.toArray(new GleapActivationMethod[internalActivationMethods.size()]));
    }
  }

  /**
   * Clears all custom data.
   */
  @ReactMethod
  public void clearCustomData() {
    Gleap.getInstance().clearCustomData();
  }

  /**
   * Replaces the network log collected by the JS interceptor (fetch and
   * XMLHttpRequest). The entries are passed on as given (ISO dates, any
   * method, failed requests without a status); the native SDK merges them
   * with its own logs and redacts them when a report is built.
   *
   * @param networkLog JSON array of network log entries collected by rn
   */
  @ReactMethod
  public void attachNetworkLog(String networkLog) {
    try {
      Gleap.getInstance().attachNetworkLogs(new JSONArray(networkLog));
    } catch (Exception | LinkageError ex) {
      System.out.println(ex);
    }
  }

  /**
   * Manually sets the network log blacklist.
   *
   * @param networkLogBlacklist Array of urls to blacklist from network logs.
   */
  @ReactMethod
  public void setNetworkLogsBlacklist(ReadableArray networkLogBlacklist) {
    try {
      String[] networkLogBlacklistArray = new String[networkLogBlacklist.size()];
      for (int i = 0; i < networkLogBlacklist.size(); i++) {
        try {
          networkLogBlacklistArray[i] = networkLogBlacklist.getString(i);
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
      Gleap.getInstance().setNetworkLogsBlacklist(networkLogBlacklistArray);
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Manually sets the network log props to ignore.
   *
   * @param networkLogPropsToIgnore Array of props to ignore from network logs.
   */
  @ReactMethod
  public void setNetworkLogPropsToIgnore(ReadableArray networkLogPropsToIgnore) {
    try {
      String[] networkLogPropsToIgnoreArray = new String[networkLogPropsToIgnore.size()];
      for (int i = 0; i < networkLogPropsToIgnore.size(); i++) {
        try {
          networkLogPropsToIgnoreArray[i] = networkLogPropsToIgnore.getString(i);
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
      Gleap.getInstance().setNetworkLogPropsToIgnore(networkLogPropsToIgnoreArray);
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Manually sets the env data props to ignore. Each call replaces the
   * previous list; an empty array resets it.
   *
   * @param envDataPropsToIgnore Array of env data keys to remove from tickets.
   */
  @ReactMethod
  public void setEnvDataPropsToIgnore(ReadableArray envDataPropsToIgnore) {
    try {
      String[] envDataPropsToIgnoreArray = new String[envDataPropsToIgnore.size()];
      for (int i = 0; i < envDataPropsToIgnore.size(); i++) {
        try {
          envDataPropsToIgnoreArray[i] = envDataPropsToIgnore.getString(i);
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
      Gleap.getInstance().setEnvDataPropsToIgnore(envDataPropsToIgnoreArray);
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Set tags to send with feedback items.
   *
   * @param tags Tags to use send with feedback items.
   */
  @ReactMethod
  public void setTags(ReadableArray tags) {
    try {
      String[] tagsArray = new String[tags.size()];
      for (int i = 0; i < tags.size(); i++) {
        try {
          tagsArray[i] = tags.getString(i);
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
      Gleap.getInstance().setTags(tagsArray);
    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Logs a custom event with data
   *
   * @param name Name of the event
   * @param data Data passed with the event.
   * @author Gleap
   */
  @ReactMethod
  void trackEvent(String name, ReadableMap data) {
    JSONObject jsonObject = null;
    try {
      jsonObject = GleapUtil.convertMapToJson(data);
      Gleap.getInstance().trackEvent(name, jsonObject);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @RequiresApi(api = Build.VERSION_CODES.O)
  @ReactMethod
  /**
   * Attaches a file to the bug report
   *
   * @param file The file to attach to the bug report
   * @author Gleap
   */
  void addAttachment(String base64file, String fileName) {
    try {
      if (checkAllowedEndings(fileName)) {
        String[] splittedBase64File = base64file.split(",");
        byte[] data;
        if (splittedBase64File.length == 2) {
          data = Base64.getDecoder().decode(splittedBase64File[1]);
        } else {
          data = Base64.getDecoder().decode(splittedBase64File[0]);
        }

        String mimetype = extractMimeType(base64file);
        String[] splitted = mimetype.split("/");
        String fileNameConcated = fileName;
        if (splitted.length == 2 && !fileName.contains(".")) {
          fileNameConcated += "." + splitted[1];
        }

        File file = new File(getReactApplicationContext().getCacheDir() + "/" + fileNameConcated);
        if (!file.exists()) {
          file.createNewFile();
        }
        try (OutputStream stream = new FileOutputStream(file)) {
          stream.write(data);
        } catch (Exception e) {
          e.printStackTrace();
        }

        if (file.exists()) {
          Gleap.getInstance().addAttachment(file);
        } else {
          System.err.println("Gleap: The file is not existing.");
        }
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  /**
   * Clear all added attachments
   */
  @ReactMethod
  public void removeAllAttachments() {
    Gleap.getInstance().removeAllAttachments();
  }

  /**
   * Extract the MIME type from a base64 string
   *
   * @param encoded Base64 string
   * @return MIME type string
   */
  private String extractMimeType(final String encoded) {
    final Pattern mime = Pattern.compile("^data:([a-zA-Z0-9]+/[a-zA-Z0-9]+).*,.*");
    final Matcher matcher = mime.matcher(encoded);
    if (!matcher.find())
      return "";
    return matcher.group(1).toLowerCase();
  }

  @ReactMethod
  public void disableConsoleLog() {
    Gleap.getInstance().disableConsoleLog();
  }
  
  @ReactMethod
  public void log(String msg) {
    Gleap.getInstance().log(msg);
  }

  @ReactMethod
  public void logWithLogLevel(String msg, String logLevel) {
    GleapLogLevel ll;
    switch (logLevel) {
      case "WARNING":
        ll = GleapLogLevel.WARNING;
        break;
      case "ERROR":
        ll = GleapLogLevel.ERROR;
        break;
      default:
        ll = GleapLogLevel.INFO;
    }
    Gleap.getInstance().log(msg, ll);
  }

  @ReactMethod
  public void showSurvey(String surveyId, String format) {
    SurveyType surveyFormat;
    switch (format) {
      case "survey_full":
        surveyFormat = SurveyType.SURVEY_FULL;
        break;
      default:
        surveyFormat = SurveyType.SURVEY;
    }
    Gleap.getInstance().showSurvey(surveyId, surveyFormat);
  }

  @ReactMethod
  public void openConversations(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openConversations(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openConversation(String shareToken) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openConversation(shareToken);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void handlePushNotification(ReadableMap notificationData) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              JSONObject jsonObject = GleapUtil.convertMapToJson(notificationData);
              Gleap.getInstance().handlePushNotification(jsonObject);
            } catch (Exception ignore) {
            }
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void startConversation(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().startConversation(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openNews(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openNews(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void startBot(String botId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().startBot(botId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openChecklists(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openChecklists(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openChecklist(String checklistId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openChecklist(checklistId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void startChecklist(String outboundId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().startChecklist(outboundId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void setDisableInAppNotifications(Boolean disableInAppNotifications) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().setDisableInAppNotifications(disableInAppNotifications);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  /**
   * Disables (true) or re-enables (false) collecting env data. When disabled,
   * tickets are sent with an empty metaData object.
   *
   * @param disableEnvData Whether env data collection is disabled.
   */
  @ReactMethod
  public void setDisableEnvData(Boolean disableEnvData) {
    // Only sets a flag, so no Activity is needed: an opt-out made before the
    // first screen must not be dropped.
    try {
      Gleap.getInstance().setDisableEnvData(Boolean.TRUE.equals(disableEnvData));
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Sets the color scheme of the widget ("auto", "light" or "dark"). "auto"
   * follows the device appearance. Null colors fall back to the dashboard
   * setting / the SDK defaults.
   *
   * @param colorScheme          The color scheme.
   * @param lightBackgroundColor Background (#rrggbb) used in light mode.
   * @param darkBackgroundColor  Background (#rrggbb) used in dark mode.
   */
  @ReactMethod
  public void setColorScheme(String colorScheme, @Nullable String lightBackgroundColor, @Nullable String darkBackgroundColor) {
    // Only sets the scheme, so no Activity is needed: a call made before the
    // first screen must not be dropped.
    try {
      Gleap.getInstance().setColorScheme(colorScheme, lightBackgroundColor, darkBackgroundColor);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Enables or disables screenshots and screen recordings for capture requests. Only sets a
   * flag, so no Activity is needed.
   *
   * @param enabled false to turn in-app screenshots and recordings off.
   */
  @ReactMethod
  public void setCaptureEnabled(boolean enabled) {
    try {
      Gleap.getInstance().setCaptureEnabled(enabled);
    } catch (Exception | LinkageError ex) {
      System.out.println(ex);
    }
  }

  /**
   * Enables or disables sending the app's logs for capture requests. Only sets a flag, so no
   * Activity is needed.
   *
   * @param enabled false to never send logs for capture requests.
   */
  @ReactMethod
  public void setRemoteLogCollectionEnabled(boolean enabled) {
    try {
      Gleap.getInstance().setRemoteLogCollectionEnabled(enabled);
    } catch (Exception | LinkageError ex) {
      System.out.println(ex);
    }
  }

  /**
   * Called by JS once it listens for flushLogs. On Android the network log is recorded in JS and
   * handed over at most every 500 ms; before the native SDK collects the logs for a capture
   * request, it asks JS for the requests it still holds back and waits at most 500 ms.
   */
  @ReactMethod
  public void registerLogFlushHandler() {
    try {
      Gleap.getInstance().setLogFlushHandler(new GleapLogFlushHandler() {
        @Override
        public void onFlushRequested(Runnable done) {
          requestLogFlush(done);
        }
      });
    } catch (Exception | LinkageError ex) {
      System.out.println(ex);
    }
  }

  /**
   * JS handed over the network requests for the flush with this id: its attachNetworkLog call
   * came first and already ran on this queue.
   */
  @ReactMethod
  public void logsFlushed(String flushId) {
    finishLogFlush(flushId);
  }

  private void requestLogFlush(@Nullable Runnable done) {
    if (done == null) {
      return;
    }
    // Nobody answers in a destroyed JS context (a reloaded one registers its own handler).
    if (invalidated) {
      done.run();
      return;
    }
    String flushId = UUID.randomUUID().toString();
    pendingLogFlushes.put(flushId, done);
    try {
      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("flushLogs", flushId);
    } catch (Exception ex) {
      finishLogFlush(flushId);
    }
  }

  private void finishLogFlush(@Nullable String flushId) {
    if (flushId == null) {
      return;
    }
    Runnable done = pendingLogFlushes.remove(flushId);
    if (done != null) {
      try {
        done.run();
      } catch (Exception ignore) {
      }
    }
  }

  private void finishPendingLogFlushes() {
    for (String flushId : pendingLogFlushes.keySet()) {
      finishLogFlush(flushId);
    }
  }

  @ReactMethod
  public void openNewsArticle(String articleId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openNewsArticle(articleId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openFeatureRequests(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openFeatureRequests(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openHelpCenter(Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openHelpCenter(showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openHelpCenterCollection(String collectionId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openHelpCenterCollection(collectionId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void openHelpCenterArticle(String articleId, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().openHelpCenterArticle(articleId, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void askAI(String question, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().askAI(question, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  @ReactMethod
  public void searchHelpCenter(String term, Boolean showBackButton) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().searchHelpCenter(term, showBackButton);
          }
        });
    } catch (NoUiThreadException e) {
    }
  }

  private boolean checkAllowedEndings(String fileName) {
    String[] fileType = fileName.split("\\.");
    String[] allowedTypes = {"jpg", "jpeg", "svg", "png", "mp4", "webp", "xml", "plain", "xml", "json"};
    if (fileType.length <= 1) {
      return false;
    }
    boolean found = false;
    for (String type : allowedTypes) {
      if (type.equals(fileType[1])) {
        found = true;
      }
    }

    return found;
  }

  /**
   * Show dev menu after shaking the phone.
   */
  private void showDevMenu() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            final ReactApplication application = (ReactApplication) getReactApplicationContext()
              .getCurrentActivity()
              .getApplication();
            Handler mainHandler = new Handler(GleapsdkModule.this.getReactApplicationContext().getMainLooper());
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
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @Override
  public void onCatalystInstanceDestroy() {
    invalidated = true;
    finishPendingLogFlushes();
    super.onCatalystInstanceDestroy();
  }

  @Override
  public void invalidate() {
    invalidated = true;
    finishPendingLogFlushes();
    super.invalidate();
  }


  private Activity getActivitySafe() throws NoUiThreadException {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      throw new NoUiThreadException();
    }
    return activity;
  }
}
