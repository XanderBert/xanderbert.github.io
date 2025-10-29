---
title: Creating Custom Tracks For the Sequencer
author: Xander Berten
layout: post
---

# Prenote
I assume you have basic knowledge about creating plugins in Unreal Engine and how Modules work.

I have kept all code in header files to be more consie

# Why?

why would you bother creating custom tracks for the sequencer?

## Extend Sequencer Beyond Animation and Camera Work
Custom tracks let you sequence anything that can be represented in C++.

### Examples:

- Trigger gameplay events at precise frame times.

- Drive AI behaviors or scripted sequences.

- Sync real-time visual effects (Niagara, lighting changes, custom shaders).

- Control procedural systems like weather or crowd simulation.

- Build interactive cutscenes that respond to player input. (i personally like this one)

This removes the ugly middle layer where you’d otherwise hack gameplay triggers into blueprints or tick functions.

This means your Sequencer timeline can become the director’s console for your game systems, not just for visuals.


## Authoring Tools for Designers and Artists

By writing a custom UMovieSceneTrack and its corresponding FMovieSceneTrackEditor, you’re actually adding a new track type directly into the Sequencer editor UI.

So now your technical designers can:

- Add this track like any other.

- See keyframes and sections.

- Modify parameters visually.

- Reuse it across projects.

It empowers non-programmers to drive custom systems through Sequencer


# How?
Now that we have a idea why this can be extremly helpful and reusable. ill try to explain how it internaly works


## Basic concepts in the Sequencer
A sequence consists of tracks
each tracks consist of sections

![sequence](/assets/images/sequence.png)

Now that we have a basic idae of how the sequencer is build up we can start creating our Sections and Track. 

Now i will start from bottom up meaning ill start with Sections and then how they fit into Tracks ..


# Runtime

## Sections

**Its important to understand that Sections have:**
-  **A class that defines a section (`UMovieSceneSection`)**

-  **A class that is the runtime instance of it (`UMovieSceneTrackInstance`)**

### UMovieSceneSection

```cpp
//This class defines a section in a track
//Here we define the data that we want in a section
UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestSection : public UMovieSceneSection, public IMovieSceneEntityProvider
{
    GENERATED_BODY()
public:
    
    UMovieSceneTestSection::UMovieSceneTestSection(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    {
        EvalOptions.CompletionMode = EMovieSceneCompletionMode::RestoreState;
        bSupportsInfiniteRange = true;
        BlendType = EMovieSceneBlendType::Absolute;
    }

    // This function describes how our Instances are created provided by inheriting from IMovieSceneEntityProvider
    virtual void ImportEntityImpl(UMovieSceneEntitySystemLinker* EntityLinker, const FEntityImportParams& Params, FImportedEntity* OutImportedEntity) override
    {
        using namespace UE::MovieScene;

        FMovieSceneTrackInstanceComponent TrackInstance{ decltype(FMovieSceneTrackInstanceComponent::Owner)(this),UMovieSceneTestSectionInstance::StaticClass() };

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


### UMovieSceneTrackInstance

The instance is mainly used to execute code at the begining and end of a section.

```cpp
// This class defines how our Instance of the section works
UCLASS(MinimalAPI)
class UMovieSceneTestSectionInstance : public UMovieSceneTrackInstance
{
	GENERATED_BODY()

	virtual void OnDestroyed() override;
    virtual void OnInputAdded(const FMovieSceneTrackInstanceInput& InInput) override;


private:
    TObjectPtr<UMovieSceneTestSection> Section{};
};
```

![section instance](/assets/images/section_instance.png)


I suggest using `OnInputAdded` to do stuff at the beginning, As you can can "grab" more context out of the sequencer (such as bound objects to this track) trough the `InInput`. This is done trough the Linker InstanceRegistry. I will write another post about this topic later on.

```cpp
    using namespace UE::MovieScene;
    const FInstanceRegistry* InstanceRegistry = GetLinker()->GetInstanceRegistry();
    const FSequenceInstance& SequenceInstance = InstanceRegistry->GetInstance(InInput.InstanceHandle);
    TSharedRef<const FSharedPlaybackState> SharedPlaybackState = SequenceInstance.GetSharedPlaybackState();
```


Okay now we have a section in a track that can do stuff when it begins and ends.

Now lets build a track for this section!

## UMovieSceneTrack
This track defines what happens when we add, remove tracks that are supported


This is mostly the same for each track you want to make.

```cpp

class UMovieSceneTestSection

UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestTrack : public UMovieSceneNameableTrack, public IMovieSceneTrackTemplateProducer
{
    GENERATED_BODY()
public:
    virtual ~UMovieSceneTestTrack() override = default;

    virtual void AddSection(UMovieSceneSection& Section) override
    {
	    //Store the newly created section for the track
	    Sections.Add(&Section);
    }

    virtual class UMovieSceneSection* CreateNewSection() override
    {
	    //Create a new section for the track
	    return NewObject<UMovieSceneSection>(this, UMovieSceneCameraChangeSection::StaticClass(), NAME_None, RF_Transactional);
    }

    virtual const TArray<UMovieSceneSection*>& GetAllSections() const override
    {
	    //Get all our sections in this track
	    return Sections;
    }

    virtual EMovieSceneTrackEasingSupportFlags SupportsEasing(FMovieSceneSupportsEasingParams& Params) const override
    {
        //This function will allow easing in out as in camera cut tracks
        //For simplicity this is set to None right now
        return EMovieSceneTrackEasingSupportFlags::None;
    }

    virtual void RemoveSection(UMovieSceneSection& section) override
    {
        //Remove the section then sort the sections in this track
	    Sections.Remove(&section);
	    MovieSceneHelpers::SortConsecutiveSections(MutableView(Sections));
    }

    virtual void RemoveSectionAt(int32 SectionIndex) override
    {
        //Remove the section then sort the sections in this track
	    UMovieSceneSection* SectionToDelete = Sections[SectionIndex];
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

    virtual bool SupportsMultipleRows() const
    {
        //Here we can define if our track can have multiple rows
        return false;
    }

    virtual bool SupportsType(TSubclassOf<UMovieSceneSection> SectionClass) const
    {
        // Here we say which sections are supported in this track
	    return SectionClass == UMovieSceneTestSection::StaticClass();
    }

#if WITH_EDITORONLY_DATA
    virtual FText GetDisplayName() const override
    {
	    //Get the display name of the track
	    return FText::FromString("Test Tack");
    }
#endif

    virtual FMovieSceneEvalTemplatePtr CreateTemplateForSection(const UMovieSceneSection& InSection) const override
    {
	    return FMovieSceneTestTemplate(*CastChecked<UMovieSceneTestSection>(&InSection), *this);
    }


private:

    /** List of all sections inside of this track */
    UPROPERTY()
    TArray<TObjectPtr<UMovieSceneSection>> Sections;
};
```

As you may have noticed we also inherited from `IMovieSceneTrackTemplateProducer` this "adds" `tick` support to our track
Every Evaluation Cycle (tick) a token will get created that evaluates. 

This means: Logic that we want in a tick while the section is active should go into the evaluation template:


## FMovieSceneEvalTemplate and IMovieSceneExecutionToken

```cpp
//Execution Token, 
//This gets used to Modify your data, 
//Sequencer data gets send from the EvalTemplate to the token and the token uses that data to change things.
struct FTestToken : public IMovieSceneExecutionToken 
{
	FTestToken() {};
	virtual void Execute(const FMovieSceneContext& Context, const FMovieSceneEvaluationOperand& Operand, FPersistentEvaluationData& PersistentData, IMovieScenePlayer& Player) override
    {
        MOVIESCENE_DETAILED_SCOPE_CYCLE_COUNTER(MovieSceneEval_OutlineTrack_TokenExecute)

        // Stuff you want to happen on the tick should go here
    }
};


//This struct gets used to evaluate the sequencer 
//This is mainly to read out the data of the sequencer
USTRUCT()
struct FMovieSceneTestTemplate : public FMovieSceneEvalTemplate
{
	GENERATED_BODY()
	FMovieSceneTestTemplate() = default;
	FMovieSceneTestTemplate(const UMovieSceneCameraChangeSection& Section, const UMovieSceneCameraChangeTrack& Track);

private:
	virtual UScriptStruct& GetScriptStructImpl() const override { return *StaticStruct(); }
	virtual void Evaluate(const FMovieSceneEvaluationOperand& Operand, const FMovieSceneContext& Context, const FPersistentEvaluationData& PersistentData, FMovieSceneExecutionTokens& ExecutionTokens) const override;
};
```

# Editor
Now we have everything setup for our runtime to work. But now we should be able to add tracks and modify them in the editor right?

This is what will be explained here