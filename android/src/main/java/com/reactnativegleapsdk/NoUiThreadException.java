package com.reactnativegleapsdk;

public class NoUiThreadException extends Exception{
  public NoUiThreadException() {
    super("No ui thread found. Please be careful when initialising the sdk.");
  }
}
