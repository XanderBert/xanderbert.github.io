---
title: Getting The Camera From The Sequencer
author: Xander Berten
layout: post
---
```cpp
	using namespace UE::MovieScene;

	if (!IsValid(sequence)) 
	{
		return;
	}


	ULevelSequencePlayer* LevelSequencePlayer{};
	ALevelSequenceActor* LevelSequenceActor{};

	//PlayerController->SetCinematicMode(bCinematicMode, bHidePlayer, bHideHUD, bPreventMovement, bPreventTurning); -> Gets called  (OnStartedPlaying) and gets filled in based on  FMovieSceneSequencePlaybackSettings
	LevelSequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(this, sequence, FMovieSceneSequencePlaybackSettings(), LevelSequenceActor);

	if (!(IsValid(LevelSequenceActor) && IsValid(LevelSequenceActor->GetSequencePlayer()) && IsValid(LevelSequenceActor->GetSequence())))
	{
		return;
	}

	UMovieSceneCameraCutTrack* CameraCutTrack = Cast<UMovieSceneCameraCutTrack>(LevelSequenceActor->GetSequence()->GetMovieScene()->GetCameraCutTrack());
	if (!IsValid(CameraCutTrack)) 
	{
		return;
	}

	TArray<UMovieSceneSection*> CameraCutSections = CameraCutTrack->GetAllSections();

	UMovieSceneCameraCutSection* MovieSceneCameraCutSection = nullptr;
	for (UMovieSceneSection* CameraCutSection : CameraCutSections) 
	{
		MovieSceneCameraCutSection = Cast<UMovieSceneCameraCutSection>(CameraCutSection);
		if (MovieSceneCameraCutSection)
		{
			break;
		}
	}

	if (!IsValid(MovieSceneCameraCutSection)) 
	{
		return;
	}


	FMovieSceneObjectBindingID CameraBindingID = MovieSceneCameraCutSection->GetCameraBindingID();
	if (!CameraBindingID.GetGuid().IsValid()) 
	{
		return;
	}

	//will assert if evaluation template isn't initialized
	TSharedRef<const FSharedPlaybackState> SharedPlaybackState = LevelSequencePlayer->GetSharedPlaybackState();
	FMovieSceneSequenceID SequenceID = SharedPlaybackState->FindCapability<FMovieSceneEvaluationState>()->FindSequenceId(LevelSequenceActor->GetSequence());
	if (!SequenceID.IsValid()) 
	{
		return;
	}


	AActor* CameraActor{};

	//Fetch the Camera Actor
	TArrayView<TWeakObjectPtr<>> Objects = CameraBindingID.ResolveBoundObjects(SequenceID, SharedPlaybackState);
	if (Objects.Num() > 0)
	{
		if (Objects[0].Get()) 
		{
			CameraActor = Cast<AActor>(Objects[0].Get());
		}
	}

```
