package com.reactnativegleapsdk;

import android.app.Activity;
import android.os.Build;
import android.os.Handler;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
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
import java.util.LinkedList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.gleap.APPLICATIONTYPE;
import io.gleap.callbacks.GetActivityCallback;
import io.gleap.Gleap;
import io.gleap.GleapActivationMethod;
import io.gleap.GleapLogLevel;
import io.gleap.GleapUserProperties;
import io.gleap.Networklog;
import io.gleap.PrefillHelper;
import io.gleap.RequestType;
import io.gleap.UserSessionController;
import io.gleap.callbacks.ConfigLoadedCallback;
import io.gleap.callbacks.CustomActionCallback;
import io.gleap.callbacks.FeedbackFlowStartedCallback;
import io.gleap.callbacks.FeedbackSendingFailedCallback;
import io.gleap.callbacks.FeedbackSentCallback;
import io.gleap.callbacks.WidgetClosedCallback;
import io.gleap.callbacks.WidgetOpenedCallback;

@ReactModule(name = GleapsdkModule.NAME)
public class GleapsdkModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  public static final String NAME = "Gleapsdk";
  private boolean isSilentBugReport = false;
  private boolean invalidated = false;

  public GleapsdkModule(ReactApplicationContext context) {
    super(context);
    Gleap.getInstance().setGetActivityCallback(new GetActivityCallback() {
      @Override
      public Activity getActivity() {
        return context.getCurrentActivity();
      }
    });

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

                Gleap.getInstance().setWidgetOpenedCallback(new WidgetOpenedCallback() {
                  @Override
                  public void invoke() {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("widgetOpened", null);
                  }
                });

                Gleap.getInstance().setWidgetClosedCallback(new WidgetClosedCallback() {
                  @Override
                  public void invoke() {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("widgetClosed", null);
                  }
                });

                Gleap.getInstance().setConfigLoadedCallback(new ConfigLoadedCallback() {
                  @Override
                  public void configLoaded(JSONObject jsonObject) {
                    if (!invalidated) {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("configLoaded", jsonObject.toString());
                    }

                  }
                });

                Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
                  @Override
                  public void invoke(String message) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("feedbackSent", message);
                  }
                });

                Gleap.getInstance().setFeedbackSendingFailedCallback(new FeedbackSendingFailedCallback() {
                  @Override
                  public void invoke(String message) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("feedbackSendingFailed", message);
                  }
                });

                Gleap.getInstance().registerCustomAction(new CustomActionCallback() {
                  @Override
                  public void invoke(String message) {
                    JSONObject obj = new JSONObject();
                    try {
                      obj.put("name", message);
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
              Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
                @Override
                public void invoke(String message) {
                  new java.util.Timer().schedule(
                    new java.util.TimerTask() {
                      @Override
                      public void run() {
                        if (!isSilentBugReport) {
                          showDevMenu();
                        } else {
                          isSilentBugReport = false;
                        }
                      }
                    },
                    500);
                }
              });
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
  public void close() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Gleap.getInstance().close();
            }catch (Exception ex) {}
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void isOpened() {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Gleap.getInstance().isOpened();
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
              Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
                @Override
                public void invoke(String message) {
                  new java.util.Timer().schedule(
                    new java.util.TimerTask() {
                      @Override
                      public void run() {
                        if (!isSilentBugReport) {
                          showDevMenu();
                        } else {
                          isSilentBugReport = false;
                        }
                      }
                    },
                    500);
                }
              });
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
            if (priority == "MEDIUM") {
              severity = Gleap.SEVERITY.MEDIUM;
            }
            if (priority == "HIGH") {
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
            if (priority == "MEDIUM") {
              severity = Gleap.SEVERITY.MEDIUM;
            }
            if (priority == "HIGH") {
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
  public void enableDebugConsoleLog() {

  }

  @ReactMethod
  public void identify(String userid, ReadableMap data) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = null;
            GleapUserProperties gleapUserSession = new GleapUserProperties();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
              if (jsonObject.has("name")) {
                gleapUserSession.setName(jsonObject.getString("name"));
              }
              if (jsonObject.has("email")) {
                gleapUserSession.setEmail(jsonObject.getString("email"));
              }
              if (jsonObject.has("phone")) {
                gleapUserSession.setPhoneNumber(jsonObject.getString("phone"));
              }
              if(jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
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
  public void identifyWithUserHash(String userid, ReadableMap data, String hash) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            JSONObject jsonObject = null;
            GleapUserProperties gleapUserSession = new GleapUserProperties();
            try {
              jsonObject = GleapUtil.convertMapToJson(data);
              if (jsonObject.has("name")) {
                gleapUserSession.setName(jsonObject.getString("name"));
              }
              if (jsonObject.has("email")) {
                gleapUserSession.setEmail(jsonObject.getString("email"));
              }
              if (jsonObject.has("phone")) {
                gleapUserSession.setPhoneNumber(jsonObject.getString("phone"));
              }
              if(jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
              }
            } catch (JSONException e) {
              e.printStackTrace();
            }
            gleapUserSession.setHash(hash);
            if (Gleap.getInstance() == null) {
              return;
            }

            if (UserSessionController.getInstance() != null) {
              Gleap.getInstance().identifyUser(userid, gleapUserSession);
            }
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
   * Frame url
   * 330,.
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
    if(Gleap.getInstance() != null) {
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
   * Log network traffic by logging it manually.
   *
   * @param networkLog Logs collected by rn
   */
  @ReactMethod
  public void attachNetworkLog(String networkLog) {
    try {
      JSONArray object = new JSONArray(networkLog);

      Networklog[] networklogs = new Networklog[object.length()];

      for (int i = 0; i < object.length(); i++) {
        JSONObject currentRequest = (JSONObject) object.get(i);
        JSONObject response = (JSONObject) currentRequest.get("response");
        JSONObject request = new JSONObject();
        if (currentRequest.has("request")) {
          request = (JSONObject) currentRequest.get("request");
        }
        networklogs[i] = new Networklog(currentRequest.getString("url"),
          RequestType.valueOf(currentRequest.getString("type")), response.getInt("status"),
          currentRequest.getInt("duration"), request, response);
      }

      Gleap.getInstance().attachNetworkLogs(networklogs);

    } catch (Exception ex) {
      System.out.println(ex);
    }
  }

  /**
   * Logs a custom event
   *
   * @param name Name of the event
   * @author Gleap
   */
  @ReactMethod
  void trackEvent(String name) {
    Gleap.getInstance().trackEvent(name);
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
    } catch (JSONException e) {
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
  public void registerConfigLoadedAction(ConfigLoadedCallback configLoadedCallback) {
    Gleap.getInstance().setConfigLoadedCallback(configLoadedCallback);
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

  private boolean checkAllowedEndings(String fileName) {
    String[] fileType = fileName.split("\\.");
    String[] allowedTypes = {"jpeg", "svg", "png", "mp4", "webp", "xml", "plain", "xml", "json"};
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
  public void onHostResume() {
  }

  @Override
  public void onHostPause() {
  }

  @Override
  public void onHostDestroy() {
  }

  @Override
  public void onCatalystInstanceDestroy() {
    invalidated = true;
    super.onCatalystInstanceDestroy();
  }

  private Activity getActivitySafe() throws NoUiThreadException {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      throw new NoUiThreadException();
    }
    return activity;
  }
}
