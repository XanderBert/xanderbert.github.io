---
title: Getting The Camera From The Sequencer
description: Resolve the camera actor bound to a Level Sequence's camera cut track in C++.
author: Xander Berten
layout: post
category: Unreal Engine
---

Sometimes you want to know which camera a Level Sequence is going to use *before* (or without) playing it, for example to blend the player camera towards it. The camera isn't stored directly on the sequence: the **camera cut track** only stores a *binding ID*, which has to be resolved into an actor through a running sequence player.

The steps are:

1. Create a Level Sequence player (and actor) for the sequence.
2. Find the camera cut track and its first camera cut section.
3. Get the camera binding ID from that section.
4. Resolve the binding into the actual camera actor.

> This uses the `FSharedPlaybackState` API that was introduced in **UE 5.5**. In older engine versions, bindings are resolved through `IMovieScenePlayer` instead.
{: .block-info }

## The code

```cpp
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "MovieScene.h"
#include "Tracks/MovieSceneCameraCutTrack.h"
#include "Sections/MovieSceneCameraCutSection.h"
#include "Evaluation/MovieSceneEvaluationState.h"
#include "Misc/ScopeExit.h"

AActor* UMyCinematicComponent::FindSequenceCamera(ULevelSequence* Sequence)
{
    using namespace UE::MovieScene;

    if (!IsValid(Sequence))
    {
        return nullptr;
    }

    // 1. Create a player. This also spawns an ALevelSequenceActor that owns it.
    //    Note: when the sequence starts playing, the player calls PlayerController->SetCinematicMode(...)
    //    with values taken from FMovieSceneSequencePlaybackSettings.
    ALevelSequenceActor* LevelSequenceActor = nullptr;
    ULevelSequencePlayer* LevelSequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(
        this, Sequence, FMovieSceneSequencePlaybackSettings(), LevelSequenceActor);

    if (!IsValid(LevelSequenceActor) || !IsValid(LevelSequencePlayer) || !IsValid(LevelSequenceActor->GetSequence()))
    {
        return nullptr;
    }

    // We only needed the actor to resolve the binding, clean it up on every exit path
    ON_SCOPE_EXIT
    {
        LevelSequenceActor->Destroy();
    };

    // 2. Find the camera cut track
    UMovieSceneCameraCutTrack* CameraCutTrack = Cast<UMovieSceneCameraCutTrack>(
        LevelSequenceActor->GetSequence()->GetMovieScene()->GetCameraCutTrack());

    if (!IsValid(CameraCutTrack))
    {
        return nullptr;
    }

    // Take the first camera cut section
    UMovieSceneCameraCutSection* CameraCutSection = nullptr;
    for (UMovieSceneSection* Section : CameraCutTrack->GetAllSections())
    {
        CameraCutSection = Cast<UMovieSceneCameraCutSection>(Section);
        if (CameraCutSection)
        {
            break;
        }
    }

    if (!IsValid(CameraCutSection))
    {
        return nullptr;
    }

    // 3. Get the binding ID of the camera
    FMovieSceneObjectBindingID CameraBindingID = CameraCutSection->GetCameraBindingID();
    if (!CameraBindingID.GetGuid().IsValid())
    {
        return nullptr;
    }

    // 4. Resolve the binding
    // Will assert if the evaluation template isn't initialized yet
    TSharedRef<const FSharedPlaybackState> SharedPlaybackState = LevelSequencePlayer->GetSharedPlaybackState();
    FMovieSceneSequenceID SequenceID = SharedPlaybackState->FindCapability<FMovieSceneEvaluationState>()
        ->FindSequenceId(LevelSequenceActor->GetSequence());

    if (!SequenceID.IsValid())
    {
        return nullptr;
    }

    TArrayView<TWeakObjectPtr<>> BoundObjects = CameraBindingID.ResolveBoundObjects(SequenceID, SharedPlaybackState);
    if (BoundObjects.Num() > 0)
    {
        return Cast<AActor>(BoundObjects[0].Get());
    }

    return nullptr;
}
```

> A sequence can contain **multiple** camera cuts. This example returns the camera of the first section it finds. If you need the camera at a specific time, check each section's range with `Section->GetRange().Contains(Frame)` instead.
{: .block-warning }

> If the camera is a **spawnable** in the sequence, it only exists while the sequence is evaluating. In that case the binding can't be resolved until the sequence has started playing.
{: .block-info }

> If you keep the returned actor pointer around, store it as a `TWeakObjectPtr<AActor>`. The camera can be destroyed when the sequence stops or the level unloads.
{: .block-tip }
