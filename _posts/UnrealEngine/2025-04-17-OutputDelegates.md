---
title: Unreal Engine Output Delegates
author: Xander Berten
layout: post
---
```cpp
DECLARE_DYNAMIC_DELEGATE(FODelegateSignature);

void DoSomething(const FODelegateSignature& OnSomethingHappened)
{
    AsyncTask(ENamedThreads::AnyThread, [OnSomethingHappened]()
    {
        OnSomethingHappened.ExecuteIfBound();
    };
}
```

<iframe src="https://blueprintue.com/render/ha3ksn1c/" scrolling="no" allowfullscreen></iframe>