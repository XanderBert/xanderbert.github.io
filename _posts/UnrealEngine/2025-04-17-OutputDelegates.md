---
title: Unreal Engine Output Delegates
author: Xander Berten
layout: post
---
```cpp
DECLARE_DYNAMIC_DELEGATE(FOnSomethingHappenedSignature);


UFUNCTION(BlueprintCallable)
void DoSomething(const FOnSomethingHappenedSignature& OnSomethingHappened)
{
    AsyncTask(ENamedThreads::AnyThread, [OnSomethingHappened]()
    {
        OnSomethingHappened.ExecuteIfBound();
    };
}
```