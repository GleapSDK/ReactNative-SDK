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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.gleap.APPLICATIONTYPE;
import io.gleap.GleapAiTool;
import io.gleap.GleapAiToolParameter;
import io.gleap.GleapSessionProperties;
import io.gleap.SurveyType;
import io.gleap.callbacks.AiToolExecutedCallback;
import io.gleap.callbacks.GetActivityCallback;
import io.gleap.Gleap;
import io.gleap.GleapActivationMethod;
import io.gleap.GleapLogLevel;
import io.gleap.Networklog;
import io.gleap.PrefillHelper;
import io.gleap.RequestType;
import io.gleap.callbacks.ConfigLoadedCallback;
import io.gleap.callbacks.InitializedCallback;
import io.gleap.callbacks.CustomActionCallback;
import io.gleap.callbacks.FeedbackFlowStartedCallback;
import io.gleap.callbacks.FeedbackSendingFailedCallback;
import io.gleap.callbacks.FeedbackSentCallback;
import io.gleap.callbacks.WidgetClosedCallback;
import io.gleap.callbacks.WidgetOpenedCallback;
import io.gleap.callbacks.RegisterPushMessageGroupCallback;
import io.gleap.callbacks.UnRegisterPushMessageGroupCallback;
import io.gleap.callbacks.NotificationUnreadCountUpdatedCallback;

@ReactModule(name = GleapsdkModule.NAME)
public class GleapsdkModule extends ReactContextBaseJavaModule {
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

                Gleap.getInstance().setConfigLoadedCallback(new ConfigLoadedCallback() {
                  @Override
                  public void configLoaded(JSONObject jsonObject) {
                    if (!invalidated) {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("configLoaded", jsonObject.toString());
                    }

                  }
                });

                Gleap.getInstance().setInitializedCallback(new InitializedCallback() {
                  @Override
                  public void initialized() {
                    if (!invalidated) {
                      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("initialized", null);
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

                Gleap.getInstance().setNotificationUnreadCountUpdatedCallback(new NotificationUnreadCountUpdatedCallback() {
                  @Override
                  public void invoke(int count) {
                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                      .emit("notificationCountUpdated", count);
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
  public void isUserIdentified(final Promise promise) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              promise.resolve(Gleap.getInstance().isUserIdentified());
            } catch (Exception ex) {
            }
          }
        });
    } catch (NoUiThreadException e) {
      System.err.println(e.getMessage());
    }
  }

  @ReactMethod
  public void getIdentity(final Promise promise) {
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
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
                map.putString("plan", gleapUser.getPlan());
                map.putString("companyName", gleapUser.getCompanyName());
                map.putString("companyId", gleapUser.getCompanyId());

                promise.resolve(map);
              } else {
                promise.resolve(null);
              }
            } catch (Exception ex) {
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
    try {
      getActivitySafe().runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            promise.resolve(Gleap.getInstance().isOpened());
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
              if (jsonObject.has("plan")) {
                gleapUserSession.setPlan(jsonObject.getString("plan"));
              }
              if (jsonObject.has("companyName")) {
                gleapUserSession.setCompanyName(jsonObject.getString("companyName"));
              }
              if (jsonObject.has("companyId")) {
                gleapUserSession.setCompanyId(jsonObject.getString("companyId"));
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
              if (jsonObject.has("plan")) {
                gleapUserSession.setPlan(jsonObject.getString("plan"));
              }
              if (jsonObject.has("companyName")) {
                gleapUserSession.setCompanyName(jsonObject.getString("companyName"));
              }
              if (jsonObject.has("companyId")) {
                gleapUserSession.setCompanyId(jsonObject.getString("companyId"));
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
              if (jsonObject.has("value")) {
                gleapUserSession.setValue(jsonObject.getDouble("value"));
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
   * Set the ai tools.
   * @param tools
   */
  @ReactMethod
  public void setAiTools(ReadableArray tools) {
    try {
      if (Gleap.getInstance() == null) {
        return;
      }

      ArrayList<GleapAiTool> gleapAiTools = new ArrayList<>();

      // Loop through the tools array
      for (int i = 0; i < tools.size(); i++) {
        ReadableMap tool = tools.getMap(i);
        if (tool == null) continue;

        String name = tool.getString("name");
        String description = tool.getString("description");
        String response = tool.getString("response");
        ReadableArray parametersArray = tool.getArray("parameters");
        ArrayList<GleapAiToolParameter> gleapParameters = new ArrayList<>();

        if (parametersArray != null) {
          // Loop through the parameters array
          for (int j = 0; j < parametersArray.size(); j++) {
            ReadableMap parameter = parametersArray.getMap(j);
            if (parameter == null) continue;

            String paramName = parameter.getString("name");
            String paramDescription = parameter.getString("description");
            String type = parameter.getString("type");
            boolean required = parameter.getBoolean("required");
            String[] enums = null;
            if (parameter.hasKey("enum") && !parameter.isNull("enum")) {
              ReadableArray enumsArray = parameter.getArray("enum");
              enums = new String[enumsArray.size()];
              for (int k = 0; k < enumsArray.size(); k++) {
                enums[k] = enumsArray.getString(k);
              }
            }

            // Create a new parameter and add it to the list
            GleapAiToolParameter gleapParameter = new GleapAiToolParameter(
              paramName, paramDescription, type, required, enums);
            gleapParameters.add(gleapParameter);
          }
        }

        // Create the AI tool with parameters
        GleapAiToolParameter[] paramsArray = new GleapAiToolParameter[gleapParameters.size()];
        paramsArray = gleapParameters.toArray(paramsArray);
        GleapAiTool gleapAiTool = new GleapAiTool(
          name, description, response, paramsArray);

        // Add the AI tool to the list
        gleapAiTools.add(gleapAiTool);
      }

      // Convert the list to an array and set the AI tools
      GleapAiTool[] toolsArray = new GleapAiTool[gleapAiTools.size()];
      toolsArray = gleapAiTools.toArray(toolsArray);
      Gleap.getInstance().setAiTools(toolsArray);

    } catch (Exception e) {
      System.out.println("Error setting AI tools: " + e);
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
   * Manually sets the network log blacklist.
   *
   * @param networkLogBlacklist Array of urls to blacklist from network logs.
   */
  @ReactMethod
  public void setNetworkLogsBlacklist(ReadableArray networkLogBlacklist) {
    try {
      String[] networkLogBlacklistArray = new String[networkLogBlacklist.size()];
      for (int i = 0; i < networkLogBlacklist.size(); i++) {
        networkLogBlacklistArray[i] = networkLogBlacklist.getString(i);
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
        networkLogPropsToIgnoreArray[i] = networkLogPropsToIgnore.getString(i);
      }
      Gleap.getInstance().setNetworkLogPropsToIgnore(networkLogPropsToIgnoreArray);
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
        tagsArray[i] = tags.getString(i);
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
    super.onCatalystInstanceDestroy();
  }

  @Override
  public void invalidate() {
    invalidated = true;
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
