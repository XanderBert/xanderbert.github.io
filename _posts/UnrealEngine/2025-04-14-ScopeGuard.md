---
title: Unreal Engine Scope Guard
author: Xander Berten
layout: post
---

## How to prevent the garbage collector to cleanup something within a scope?
```cpp
FGCObjectScopeGuard
```

This can be especially usefull in lambda's

```cpp
UObject* CreatedObject = NewObject<UObject>();
AsyncTask(ENamedThreads::AnyThread, [CreatedObject]()
{
    // Ensures CreatedObject won't be garbage collected in this scope
	FGCObjectScopeGuard CreatedObjectGuard(CreatedObject);
};
```