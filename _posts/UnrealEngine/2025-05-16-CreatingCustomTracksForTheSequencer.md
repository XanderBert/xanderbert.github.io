---
title: Creating Custom Tracks For the Sequencer
author: Xander Berten
layout: post
---



## UMovieSceneSection

```cpp
#pragma once
#include "CoreMinimal.h"
#include "MovieSceneSection.h"
#include "TestSection.generated.h"

UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestSection :public UMovieSceneSection
{
    GENERATED_BODY()
public:
    UMovieSceneTestSection(const FObjectInitializer& ObjectInitializer);
    virtual ~UMovieSceneTestSection();

public:
#if WITH_EDITOR
    virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif
private:
};
```



## UMovieSceneTrack

```cpp
#pragma once
#include "Tracks/MovieSceneSpawnTrack.h"
#include "Compilation/IMovieSceneTrackTemplateProducer.h"
#include "Camera/CameraActor.h"
#include "MovieSceneNameableTrack.h"
#include "TestTrack.generated.h"

class UMovieSceneTestSection;

UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestTrack : public UMovieSceneNameableTrack, public IMovieSceneTrackTemplateProducer
{
    GENERATED_BODY()
public:
    UMovieSceneTestTrack(const FObjectInitializer& ObjectInitializer);
    virtual ~UMovieSceneTestTrack();

public:
    virtual void AddSection(UMovieSceneSection& Section) override;
    virtual class UMovieSceneSection* CreateNewSection() override;
    virtual const TArray& GetAllSections() const override;
    virtual bool HasSection(const UMovieSceneSection& Section) const override;
    virtual bool IsEmpty() const override;

    virtual void RemoveSection(UMovieSceneSection & Section) override;
    virtual FName GetTrackName() const;
    virtual bool SupportsMultipleRows() const;
    virtual bool SupportsType(TSubclassOf SectionClass) const;

    TWeakObjectPtr TestCameraActor;

    virtual FMovieSceneEvalTemplatePtr CreateTemplateForSection const UMovieSceneSection& InSection) const override;

private:
    UPROPERTY()
    TArray Sections;
};
```


## ISequencerSection
```cpp
class FMovieSceneTestSection : public ISequencerSection
, public TSharedFromThis
{
public:
    FMovieSceneTestSection(UMovieSceneSection& InSection, TWeakPtr InSequencer);
    virtual ~FMovieSceneTestSection();

public:
    virtual UMovieSceneSection* GetSectionObject() override;

    virtual FText GetSectionTitle() const override;
    virtual FText GetSectionToolTip() const override;
    virtual float GetSectionHeight() const override;

    virtual int32 OnPaintSection(FSequencerSectionPainter& Painter) const override;
    virtual bool SectionIsResizable() const{ return true; }
    virtual void GenerateSectionLayout(class ISectionLayoutBuilder& LayoutBuilder);

    virtual void BeginResizeSection() override;
    virtual void ResizeSection(ESequencerSectionResizeMode ResizeMode, FFrameNumber ResizeTime) override;

    virtual void BeginSlipSection() override;
    virtual void SlipSection(FFrameNumber SlipTime) override;

private:
    TWeakObjectPtr Section;
    TWeakPtr Sequencer;
};
```

## FMovieSceneTrackEditor
```cpp
class CUSTOMSEQUENCERPLUGIN_API FMovieSceneTestPreviewEditor : public FMovieSceneTrackEditor
{
public:
    FMovieSceneTestPreviewEditor(TSharedRef InSequencer);
    virtual ~FMovieSceneTestPreviewEditor();

    static TSharedRef CreateTrackEditor(TSharedRef OwningSequencer);

public:
    virtual TSharedRef MakeSectionInterface(UMovieSceneSection& SectionObject, UMovieSceneTrack& Track, FGuid ObjectBinding) override;
    virtual bool SupportsSequence(UMovieSceneSequence* InSequence) const override;
    virtual bool SupportsType(TSubclassOf Type) const override;
    virtual const FSlateBrush* GetIconBrush() const override;
    virtual void BuildObjectBindingTrackMenu(FMenuBuilder& MenuBuilder, const TArray& ObjectBindings, const UClass* ObjectClass) override;
    virtual bool IsResizable(UMovieSceneTrack* InTrack) const override;

    virtual bool OnAllowDrop(const FDragDropEvent& DragDropEvent, FSequencerDragDropParams& DragDropParams) override;
    virtual FReply OnDrop(const FDragDropEvent& DragDropEvent, const FSequencerDragDropParams& DragDropParams) override;

private:
    void HandleAddTrackOnActorMenuEntryExecute(FMenuBuilder&, TArray);
};
```

## FMovieSceneEvalTemplate
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Evaluation/MovieSceneEvalTemplate.h"
#include "../Tracks/TestPreviewTrack.h"
#include "TestPreviewTemplate.generated.h"

class UMovieSceneTestPreviewTrack;
class UMovieSceneTestPreviewSection;

USTRUCT()
struct FMovieSceneTestPreviewSectionTemplate : public FMovieSceneEvalTemplate
{
    GENERATED_BODY()

    FMovieSceneTestPreviewSectionTemplate();
    FMovieSceneTestPreviewSectionTemplate(const UMovieSceneTestPreviewSection& Section, const UMovieSceneTestPreviewTrack& Track);

private:
    virtual UScriptStruct& GetScriptStructImpl() const override { return *StaticStruct(); }
    virtual void Evaluate(const FMovieSceneEvaluationOperand& Operand, const FMovieSceneContext& Context, const FPersistentEvaluationData& PersistentData, FMovieSceneExecutionTokens& ExecutionTokens) const override;

};

```

## IMovieSceneExecutionToken
```cpp
void FMovieSceneTestPreviewSectionTemplate::Evaluate(const FMovieSceneEvaluationOperand& Operand, const FMovieSceneContext& Context, const FPersistentEvaluationData& PersistentData, FMovieSceneExecutionTokens& ExecutionTokens) const
{
    if (GEngine && GEngine->UseSound() && Context.GetStatus() != EMovieScenePlayerStatus::Jumping)
    {
        const UMovieSceneTestPreviewSection* TestSection = Cast(GetSourceSection());

        float TimeValue = Context.GetTime().AsDecimal() / 100;
        UMovieSceneTestPreviewTrack* TestTrack = Cast(TestSection->GetOuter());
        ExecutionTokens.Add(FTestPreviewSectionExecutionToken(TestSection, FVector(0,0,TimeValue)));
    }
}
```
```cpp
UCLASS()
class CUSTOMSEQUENCERPLUGIN_API UMovieSceneTestPreviewTrack : public UMovieSceneNameableTrack, public IMovieSceneTrackTemplateProducer
{
    GENERATED_BODY()
public:
...
virtual FMovieSceneEvalTemplatePtr CreateTemplateForSection(const UMovieSceneSection& InSection) const override;
...
}


FMovieSceneEvalTemplatePtr UMovieSceneTestPreviewTrack::CreateTemplateForSection(const UMovieSceneSection& InSection) const
{
    return FMovieSceneTestPreviewSectionTemplate(*CastChecked(&InSection), *this);
}

```