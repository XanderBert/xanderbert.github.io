---
title: Creating Custom Tracks For The Sequencer
description: Extend Unreal's Sequencer with your own track and section types in C++.
author: Xander Berten
layout: post
category: Unreal Engine
---

> I assume you have basic knowledge of creating plugins in Unreal Engine and how modules work. To keep things concise, all code in this post is written in header files.
{: .block-info }

## Why?

Why would you bother creating custom tracks for the Sequencer?

### Extend the Sequencer beyond animation and camera work

Custom tracks let you sequence **anything** that can be represented in C++. For example:

- Trigger gameplay events at precise frames.
- Drive AI behaviors or scripted sequences.
- Sync real-time visual effects (Niagara, lighting changes, custom shaders).
- Control procedural systems like weather or crowd simulation.
- Build interactive cutscenes that respond to player input (I personally like this one).

This removes the ugly middle layer where you'd otherwise hack gameplay triggers into Blueprints or tick functions. Your Sequencer timeline becomes the director's console for your game systems, not just for visuals.

### Authoring tools for designers and artists

By writing a custom `UMovieSceneTrack` and its corresponding `FMovieSceneTrackEditor`, you are adding a new track type directly to the Sequencer editor UI.

So now your technical designers can:

- Add this track like any other.
- See keyframes and sections.
- Modify parameters visually.
- Reuse it across projects.

It empowers non-programmers to drive custom systems through the Sequencer.

## How?

Now that we have an idea of why this can be extremely helpful and reusable, I'll explain how it works internally.

### Basic concepts in the Sequencer

- A **sequence** consists of **tracks**.
- Each **track** consists of **sections**: blocks on the timeline with a start and an end.

![A sequence with tracks and sections](/assets/images/sequence.png)

We'll build this bottom-up: first the section, then the track that holds the sections.

**Overview of the classes we'll create:**

| Class | Module | Purpose |
|---|---|---|
| `UMovieSceneTestSection` | Runtime | The data of one section on the timeline |
| `UMovieSceneTestSectionInstance` | Runtime | Runs code when a section starts and ends |
| `UMovieSceneTestTrack` | Runtime | Holds and manages the sections |
| `FMovieSceneTestTemplate` + `FTestToken` | Runtime | Runs code every frame while a section is active |
| `FMovieSceneTestTrackEditor` | Editor | Makes the track show up in the Sequencer UI |

## Runtime

### Sections

It's important to understand that a section consists of **two** classes:

- **A class that defines the section** (`UMovieSceneSection`). This is the data you edit in the Sequencer.
- **A class that is the runtime instance of it** (`UMovieSceneTrackInstance`). This is the object that actually *does* something while the sequence plays.

#### UMovieSceneSection

```cpp
#include "MovieSceneSection.h"
#include "EntitySystem/IMovieSceneEntityProvider.h"
#include "EntitySystem/BuiltInComponentTypes.h"
#include "EntitySystem/TrackInstance/MovieSceneTrackInstance.h"
#include "MovieSceneTestSection.generated.h"

class UMovieSceneTestSectionInstance;

// Defines a section in our track.
// This is where we define the data we want to edit per section.
UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestSection : public UMovieSceneSection, public IMovieSceneEntityProvider
{
    GENERATED_BODY()

public:
    UMovieSceneTestSection(const FObjectInitializer& ObjectInitializer)
        : Super(ObjectInitializer)
    {
        // Restore everything we changed once the section is done
        EvalOptions.CompletionMode = EMovieSceneCompletionMode::RestoreState;
        bSupportsInfiniteRange = true;
        BlendType = EMovieSceneBlendType::Absolute;
    }

    // Provided by IMovieSceneEntityProvider.
    // Describes how the runtime instance of this section is created.
    virtual void ImportEntityImpl(UMovieSceneEntitySystemLinker* EntityLinker, const FEntityImportParams& Params, FImportedEntity* OutImportedEntity) override
    {
        using namespace UE::MovieScene;

        FMovieSceneTrackInstanceComponent TrackInstance{ decltype(FMovieSceneTrackInstanceComponent::Owner)(this), UMovieSceneTestSectionInstance::StaticClass() };

        OutImportedEntity->AddBuilder(
            FEntityBuilder()
            .AddTag(FBuiltInComponentTypes::Get()->Tags.Root)
            .Add(FBuiltInComponentTypes::Get()->TrackInstance, TrackInstance)
        );
    }

    UPROPERTY(EditAnywhere)
    FViewTargetTransitionParams InTransitionParams;

    UPROPERTY(EditAnywhere)
    FViewTargetTransitionParams OutTransitionParams;
};
```

> `ImportEntityImpl` uses `UMovieSceneTestSectionInstance::StaticClass()`, so the full declaration of the instance class must be included in the file where this function is compiled. A forward declaration is not enough.
{: .block-warning }

#### UMovieSceneTrackInstance

The instance is mainly used to execute code at the **beginning** and **end** of a section:

- `OnInputAdded` is called when a section becomes active.
- `OnInputRemoved` is called when a section stops being active.
- `OnAnimate` is called every frame while at least one section is active.
- `OnDestroyed` is called when the instance is cleaned up.

```cpp
// Defines what happens at runtime while our section is active
UCLASS(MinimalAPI)
class UMovieSceneTestSectionInstance : public UMovieSceneTrackInstance
{
    GENERATED_BODY()

protected:
    virtual void OnInputAdded(const FMovieSceneTrackInstanceInput& InInput) override
    {
        Section = Cast<UMovieSceneTestSection>(InInput.Section);
        // Section started
    }

    virtual void OnInputRemoved(const FMovieSceneTrackInstanceInput& InInput) override
    {
        // Section ended
    }

    virtual void OnDestroyed() override
    {
        Section = nullptr;
    }

private:
    UPROPERTY()
    TObjectPtr<UMovieSceneTestSection> Section;
};
```

![Section instance callbacks on the timeline](/assets/images/section_instance.png)

I suggest using `OnInputAdded` to run code at the beginning of a section, because you can "grab" more context out of the Sequencer (such as the objects bound to this track) through `InInput`. This is done through the linker's instance registry:

```cpp
virtual void OnInputAdded(const FMovieSceneTrackInstanceInput& InInput) override
{
    using namespace UE::MovieScene;

    const FInstanceRegistry* InstanceRegistry = GetLinker()->GetInstanceRegistry();
    const FSequenceInstance& SequenceInstance = InstanceRegistry->GetInstance(InInput.InstanceHandle);
    TSharedRef<const FSharedPlaybackState> SharedPlaybackState = SequenceInstance.GetSharedPlaybackState();

    // Use SharedPlaybackState to resolve bindings, get the playback context (world), etc.
}
```

> I'll write a separate post about the instance registry and resolving bindings. For an example of resolving a binding, see [Getting The Camera From The Sequencer]({% post_url UnrealEngine/2025-05-16-GettingTheCameraFromTheSequencer %}).
{: .block-tip }

Okay, now we have a section that can do things when it begins and ends. Let's build a track for it!

### UMovieSceneTrack

The track manages its sections: it creates, stores and removes them, and it defines which section types it supports.

Most of this is the same for every track you make.

```cpp
#include "MovieSceneNameableTrack.h"
#include "Compilation/IMovieSceneTrackTemplateProducer.h"
#include "MovieSceneTestSection.h"
#include "MovieSceneTestTemplate.h"
#include "MovieSceneTestTrack.generated.h"

UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestTrack : public UMovieSceneNameableTrack, public IMovieSceneTrackTemplateProducer
{
    GENERATED_BODY()

public:
    virtual void AddSection(UMovieSceneSection& Section) override
    {
        // Store the newly created section in this track
        Sections.Add(&Section);
    }

    virtual UMovieSceneSection* CreateNewSection() override
    {
        // Create a new section for this track
        return NewObject<UMovieSceneTestSection>(this, NAME_None, RF_Transactional);
    }

    virtual const TArray<UMovieSceneSection*>& GetAllSections() const override
    {
        return Sections;
    }

    virtual EMovieSceneTrackEasingSupportFlags SupportsEasing(FMovieSceneSupportsEasingParams& Params) const override
    {
        // Return EMovieSceneTrackEasingSupportFlags::All to allow easing in/out like camera cut tracks.
        // For simplicity it's disabled here.
        return EMovieSceneTrackEasingSupportFlags::None;
    }

    virtual void RemoveSection(UMovieSceneSection& Section) override
    {
        // Remove the section, then sort the remaining sections
        Sections.Remove(&Section);
        MovieSceneHelpers::SortConsecutiveSections(MutableView(Sections));
    }

    virtual void RemoveSectionAt(int32 SectionIndex) override
    {
        Sections.RemoveAt(SectionIndex);
        MovieSceneHelpers::SortConsecutiveSections(MutableView(Sections));
    }

    virtual bool HasSection(const UMovieSceneSection& Section) const override
    {
        return Sections.Contains(&Section);
    }

    virtual bool IsEmpty() const override
    {
        return Sections.Num() == 0;
    }

    virtual void RemoveAllAnimationData() override
    {
        Sections.Empty();
    }

    virtual bool SupportsMultipleRows() const override
    {
        // Can sections be stacked on multiple rows in this track?
        return false;
    }

    virtual bool SupportsType(TSubclassOf<UMovieSceneSection> SectionClass) const override
    {
        // Which section types can be added to this track
        return SectionClass == UMovieSceneTestSection::StaticClass();
    }

#if WITH_EDITORONLY_DATA
    virtual FText GetDefaultDisplayName() const override
    {
        return NSLOCTEXT("CustomSequencer", "TestTrackName", "Test Track");
    }
#endif

    // Provided by IMovieSceneTrackTemplateProducer
    virtual FMovieSceneEvalTemplatePtr CreateTemplateForSection(const UMovieSceneSection& InSection) const override
    {
        return FMovieSceneTestTemplate(*CastChecked<UMovieSceneTestSection>(&InSection), *this);
    }

private:
    /** All sections in this track */
    UPROPERTY()
    TArray<TObjectPtr<UMovieSceneSection>> Sections;
};
```

> `Sections` **must** be a `UPROPERTY`. Otherwise the sections aren't saved with the sequence, and the garbage collector can delete them while the track still points to them.
{: .block-warning }

### Evaluation template and execution token

You may have noticed that the track also inherits from `IMovieSceneTrackTemplateProducer`. This adds *tick* support to our track: every evaluation (each frame while a section is active), the template is evaluated and produces **execution tokens** that do the actual work.

This means: logic that should run every frame while the section is active goes into the evaluation template and its token.

Why two steps? The template only **reads** the sequence data and describes what should happen. The token **applies** it. This split lets the Sequencer evaluate everything first and then execute all changes together in the right order.

```cpp
#include "Evaluation/MovieSceneEvalTemplate.h"
#include "Evaluation/MovieSceneExecutionTokens.h"
#include "MovieSceneTestTemplate.generated.h"

class UMovieSceneTestSection;
class UMovieSceneTestTrack;

// Execution token: this is where you change things.
// The template passes the data it read from the Sequencer to the token, and the token applies it.
struct FTestToken : public IMovieSceneExecutionToken
{
    FTestToken() = default;

    virtual void Execute(const FMovieSceneContext& Context, const FMovieSceneEvaluationOperand& Operand, FPersistentEvaluationData& PersistentData, IMovieScenePlayer& Player) override
    {
        MOVIESCENE_DETAILED_SCOPE_CYCLE_COUNTER(MovieSceneEval_TestTrack_TokenExecute)

        // Things you want to happen every frame go here
    }
};

// Evaluation template: reads out the Sequencer data for the current frame
USTRUCT()
struct FMovieSceneTestTemplate : public FMovieSceneEvalTemplate
{
    GENERATED_BODY()

    FMovieSceneTestTemplate() = default;
    FMovieSceneTestTemplate(const UMovieSceneTestSection& Section, const UMovieSceneTestTrack& Track) {}

private:
    virtual UScriptStruct& GetScriptStructImpl() const override { return *StaticStruct(); }

    virtual void Evaluate(const FMovieSceneEvaluationOperand& Operand, const FMovieSceneContext& Context, const FPersistentEvaluationData& PersistentData, FMovieSceneExecutionTokens& ExecutionTokens) const override
    {
        // Read what you need from Context (current time, playback status, ...) and hand it to the token
        ExecutionTokens.Add(FTestToken());
    }
};
```

> Evaluation templates and execution tokens are the **legacy** evaluation path. Newer engine tracks use the entity component system (the `IMovieSceneEntityProvider` + `UMovieSceneTrackInstance` approach from above, where `OnAnimate` runs every frame). Both still work, but if you only need per-frame logic, `OnAnimate` on the track instance is the more future-proof option.
{: .block-info }

## Editor

Now everything is set up for our runtime to work. But we also want to be able to add these tracks and modify them in the editor, right? That's what the `FMovieSceneTrackEditor` in the editor module is for.

> This part is still being written. Check back soon!
{: .block-info }
