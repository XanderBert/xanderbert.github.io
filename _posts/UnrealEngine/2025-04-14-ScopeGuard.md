---
title: Scope Guard
description: Keep a UObject alive for the duration of a scope with FGCObjectScopeGuard.
author: Xander Berten
layout: post
category: Unreal Engine
---

## How do you prevent the garbage collector from cleaning up an object within a scope?

A `UObject` that is not referenced by a `UPROPERTY` (or another object the garbage collector knows about) can be destroyed at any garbage collection pass. When you only need an object for a short while, for example a temporary object you create inside a function, you can protect it with `FGCObjectScopeGuard`:

```cpp
#include "UObject/GCObjectScopeGuard.h"

void UMyEditorTool::ProcessSomething()
{
    UMyTempObject* TempObject = NewObject<UMyTempObject>();

    // TempObject can't be garbage collected until Guard goes out of scope
    FGCObjectScopeGuard Guard(TempObject);

    // ... work that might trigger a garbage collection (loading assets, ticking, etc.)
}
```

Internally, the guard is an `FGCObject` that reports the object to the garbage collector as long as the guard exists.

## Keeping objects alive in async code

This is especially useful with lambdas that run later. The important part is **when** the object gets protected: a garbage collection can happen between creating the lambda and the moment it actually runs.

For that case, use `TStrongObjectPtr`. It works like a scope guard, but it can be copied into the lambda so the object stays alive until the lambda is destroyed:

```cpp
#include "UObject/StrongObjectPtr.h"

UMyTempObject* CreatedObject = NewObject<UMyTempObject>();

// Take the strong reference on the game thread, *before* the task is queued
TStrongObjectPtr<UMyTempObject> StrongObject(CreatedObject);

AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [StrongObject]()
{
    // StrongObject is guaranteed to be alive here
    UMyTempObject* Object = StrongObject.Get();
});
```

> Don't create an `FGCObjectScopeGuard` *inside* the async lambda. By the time the lambda runs, the object may already be garbage collected, and creating/destroying the guard off the game thread is not safe.
{: .block-warning }

> Keeping an object alive does **not** make it thread-safe. Most `UObject` functions (and anything touching the world) must still be called on the game thread.
{: .block-info }
