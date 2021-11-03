package com.reactnativegleapsdk;


import android.app.Activity;
import android.os.Build;
import android.os.Handler;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.gleap.APPLICATIONTYPE;
import io.gleap.ConfigLoadedCallback;
import io.gleap.CustomActionCallback;
import io.gleap.FeedbackSentCallback;
import io.gleap.FeedbackWillBeSentCallback;
import io.gleap.Gleap;
import io.gleap.GleapUserProperties;
import io.gleap.RequestType;

@ReactModule(name = GleapsdkModule.NAME)
public class GleapsdkModule extends ReactContextBaseJavaModule {
  public static final String NAME = "Gleapsdk";
  private boolean isSilentBugReport = false;

  public GleapsdkModule(ReactApplicationContext reactContext) {
    super(reactContext);
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
    getCurrentActivity().runOnUiThread(
      new Runnable() {
        @Override
        public void run() {
          try {
            Activity activity = getReactApplicationContext()
              .getCurrentActivity();
            if (activity != null) {
              Gleap.getInstance().setApplicationType(APPLICATIONTYPE.REACTNATIVE);
              Gleap.getInstance().setFeedbackWillBeSentCallback(new FeedbackWillBeSentCallback() {
                @Override
                public void flowInvoced() {
                  getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("feedbackWillBeSent", null);
                }
              });
              Gleap.initialize(sdkKey, activity.getApplication());
              Gleap.getInstance().setConfigLoadedCallback(new ConfigLoadedCallback() {
                @Override
                public void configLoaded(JSONObject jsonObject) {
                  getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("configLoaded", jsonObject.toString());
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

                  getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("customActionTriggered", obj.toString());
                }
              });
              Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
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
      }
    );
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void open() {
    getCurrentActivity().runOnUiThread(
      new Runnable() {
        @Override
        public void run() {
          try {
            Gleap.getInstance().startFeedbackFlow();
            Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
              @Override
              public void close() {
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
                  500
                );
              }
            });
          } catch (Exception e) {
            System.out.println(e);
          }
        }
      });
  }

  /**
   * Start bug report manually by calling this function.
   */
  @ReactMethod
  public void startFeedbackFlow(String feedbackFlow) {
    getCurrentActivity().runOnUiThread(
      new Runnable() {
        @Override
        public void run() {
          try {
            Gleap.getInstance().startFeedbackFlow(feedbackFlow);
            Gleap.getInstance().setFeedbackSentCallback(new FeedbackSentCallback() {
              @Override
              public void close() {
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
                  500
                );
              }
            });
          } catch (Exception e) {
            System.out.println(e);
          }
        }
      });
  }

  /**
   * Manually start a silent bug reporting workflow.
   */
  @ReactMethod
  public void sendSilentBugReport(
    String description,
    String priority
  ) {
    getCurrentActivity().runOnUiThread(
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
          Gleap.getInstance().sendSilentBugReport(description, severity);
        }
      });
  }

  @ReactMethod
  public void setLanguage(String language) {
    Gleap.getInstance().setLanguage(language);
  }

  @ReactMethod
  public void identify(String userid, ReadableMap data) {
    getCurrentActivity().runOnUiThread(
      new Runnable() {
        @Override
        public void run() {
          JSONObject jsonObject = null;
          String name = "";
          String email = "";
          try {
            jsonObject = GleapUtil.convertMapToJson(data);
            if (jsonObject.has("name")) {
              name = jsonObject.getString("name");
            }
            if (jsonObject.has("email")) {
              email = jsonObject.getString("email");
            }
          } catch (JSONException e) {
            e.printStackTrace();
          }
          GleapUserProperties gleapUserSession = new GleapUserProperties(name, email);
          Gleap.getInstance().identifyUser(userid, gleapUserSession);
        }
      });
  }

  @ReactMethod
  public void clearIdentity() {
    Gleap.getInstance().clearIdentity();
  }

  /**
   * Attaches custom data, which can be viewed in the BugBattle dashboard. New data will be merged with existing custom data.
   *
   * @param customData The data to attach to a bug report.
   * @author BugBattle
   */
  @ReactMethod
  public void attachCustomData(ReadableMap customData) {
    try {
      JSONObject jsonObject = GleapUtil.convertMapToJson(customData);
      Gleap.getInstance().appendCustomData(jsonObject);
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
   * Used for dedicated server. Set the url, where the widget is loaded from.
   *
   * @param widgetUrl Url to the dedicated server.
   */
  @ReactMethod
  public void setWidgetUrl(String widgetUrl) {
    try {
      Gleap.getInstance().setApiUrl(widgetUrl);
    } catch (Exception e) {
      System.out.println(e);
    }
  }

  /**
   * Attaches custom data, which can be viewed in the Gleap dashboard. New data will be merged with existing custom data.
   *
   * @param customData The data to attach to a bug report.
   * @author Gleap
   */
  @ReactMethod
  public void appendCustomData(ReadableMap customData) {
    try {
      JSONObject jsonObject = GleapUtil.convertMapToJson(customData);
      Gleap.getInstance().appendCustomData(jsonObject);
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
      for (int i = 0; i < object.length(); i++) {
        JSONObject currentRequest = (JSONObject) object.get(i);
        JSONObject response = (JSONObject) currentRequest.get("response");
        JSONObject request = new JSONObject();
        if (currentRequest.has("request")) {
          request = (JSONObject) currentRequest.get("request");
        }
        Gleap.getInstance().logNetwork(currentRequest.getString("url"), RequestType.valueOf(currentRequest.getString("type")), response.getInt("status"), currentRequest.getInt("duration"), request, response);
      }

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
  void logEvent(String name) {
    Gleap.getInstance().logEvent(name);
  }

  /**
   * Logs a custom event with data
   *
   * @param name Name of the event
   * @param data Data passed with the event.
   * @author Gleap
   */
  @ReactMethod
  void logEvent(String name, ReadableMap data) {
    JSONObject jsonObject = null;
    try {
      jsonObject = GleapUtil.convertMapToJson(data);
      Gleap.getInstance().logEvent(name, jsonObject);
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

  ;

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
    getCurrentActivity().runOnUiThread(
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
  }
}
