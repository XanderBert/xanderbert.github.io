---
title: Output Delegates
description: Give Blueprint nodes an execution pin that fires when async work is done.
author: Xander Berten
layout: post
category: Unreal Engine
---

If a `UFUNCTION` takes a **dynamic delegate** as a parameter, Blueprints show it as an extra red pin on the node. You can drag off that pin to create a custom event that you call whenever your (async) work is finished.

## Declaring the delegate and the function

```cpp
// A delegate without parameters. Use DECLARE_DYNAMIC_DELEGATE_OneParam etc. to pass data back.
DECLARE_DYNAMIC_DELEGATE(FOnSomethingHappenedSignature);

UCLASS()
class UMyBlueprintLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable)
    static void DoSomething(const FOnSomethingHappenedSignature& OnSomethingHappened)
    {
        AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [OnSomethingHappened]()
        {
            // ... heavy work on a background thread ...

            // Go back to the game thread before calling into Blueprints
            AsyncTask(ENamedThreads::GameThread, [OnSomethingHappened]()
            {
                OnSomethingHappened.ExecuteIfBound();
            });
        });
    }
};
```

> Blueprint code must run on the **game thread**. Executing the delegate directly from a background thread can cause random crashes, so always dispatch back to `ENamedThreads::GameThread` first.
{: .block-warning }

## Passing data back

```cpp
DECLARE_DYNAMIC_DELEGATE_OneParam(FOnResultSignature, int32, Result);

UFUNCTION(BlueprintCallable)
static void CalculateSomething(const FOnResultSignature& OnResult);
```

> The delegate is passed **by value** into the lambda. A dynamic delegate only holds a *weak* reference to the object it is bound to, so `ExecuteIfBound` safely does nothing if that Blueprint was destroyed in the meantime.
{: .block-info }

> If you need multiple outputs (e.g. *On Success* and *On Failure*) or a node that shows its output pins without dragging off events, look into `UBlueprintAsyncActionBase`. It creates a proper latent-style async node.
{: .block-tip }
