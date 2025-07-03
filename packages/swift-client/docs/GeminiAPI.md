# GeminiAPI

All URIs are relative to *http://127.0.0.1:0*

Method | HTTP request | Description
------------- | ------------- | -------------
[**geminiAskPost**](GeminiAPI.md#geminiaskpost) | **POST** /gemini/ask | 


# **geminiAskPost**
```swift
    open class func geminiAskPost(geminiAskPostRequest: GeminiAskPostRequest? = nil, completion: @escaping (_ data: GeminiAskPost200Response?, _ error: Error?) -> Void)
```



Execute a Gemini CLI command with the provided prompt

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import RemoteTestToolsClient

let geminiAskPostRequest = _gemini_ask_post_request(prompt: "prompt_example", args: ["args_example"]) // GeminiAskPostRequest |  (optional)

GeminiAPI.geminiAskPost(geminiAskPostRequest: geminiAskPostRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **geminiAskPostRequest** | [**GeminiAskPostRequest**](GeminiAskPostRequest.md) |  | [optional] 

### Return type

[**GeminiAskPost200Response**](GeminiAskPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

