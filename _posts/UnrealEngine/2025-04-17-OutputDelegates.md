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
<!---
<div style="width: 100%; max-width: 1000px; height: 600px;">
  <iframe 
    src="https://blueprintue.com/render/ha3ksn1c/" 
    style="width: 100%; height: 100%;" 
    scrolling="no" 
    allowfullscreen>
  </iframe>
</div>
-->
