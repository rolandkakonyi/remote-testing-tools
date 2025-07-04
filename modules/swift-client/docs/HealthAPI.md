# HealthAPI

All URIs are relative to *http://127.0.0.1:0*

Method | HTTP request | Description
------------- | ------------- | -------------
[**healthGet**](HealthAPI.md#healthget) | **GET** /health | 


# **healthGet**
```swift
    open class func healthGet(completion: @escaping (_ data: HealthGet200Response?, _ error: Error?) -> Void)
```



Health check endpoint

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import RemoteTestToolsClient


HealthAPI.healthGet() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

[**HealthGet200Response**](HealthGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

