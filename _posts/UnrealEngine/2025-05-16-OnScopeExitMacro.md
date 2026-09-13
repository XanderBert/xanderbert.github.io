---
title: On Scope Exit Macro
description: Run cleanup code automatically when leaving a scope with ON_SCOPE_EXIT.
author: Xander Berten
layout: post
category: Unreal Engine
---

`ON_SCOPE_EXIT` takes a block of code that runs automatically when the current scope ends, no matter *how* it ends: reaching the closing brace, an early `return`, or a `break`/`continue` out of a loop.

This is really handy when a function has a lot of exit conditions, because you don't have to duplicate the cleanup code before every `return`.

```cpp
#include "Misc/ScopeExit.h"

void UMyComponent::PlayPreview(ULevelSequence* Sequence)
{
    ALevelSequenceActor* LevelSequenceActor = SpawnPreviewActor(Sequence);
    ULevelSequencePlayer* LevelSequencePlayer = LevelSequenceActor->GetSequencePlayer();

    ON_SCOPE_EXIT
    {
        // Runs on every return below
        LevelSequenceActor->Destroy();
    };

    if (!IsValid(LevelSequencePlayer))
    {
        return;
    }

    if (!LevelSequencePlayer->IsPlaying())
    {
        return;
    }

    // ...
}
```

> Don't forget the **semicolon** after the closing brace. The macro creates a variable initialized with a lambda, so `};` is required or it won't compile.
{: .block-warning }

> Variables are captured **by reference**. Declare `ON_SCOPE_EXIT` *after* the variables it uses, otherwise they won't exist yet.
{: .block-info }

> Only register the cleanup once the thing you want to clean up actually exists. In the example above the `ON_SCOPE_EXIT` comes after spawning the actor, so we never try to destroy a `nullptr`.
{: .block-tip }
