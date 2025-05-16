---
title: Unreal Engine Better Data Assets
author: Xander Berten
layout: post
---

# Instanced Data In custom blueprints
There is no good way in unreal to have a Data Asset that is able to store Instanced Data.
Creating a data only `UObject` and passing that as a `TSoftClassPtr` does make it able to do that.


## Modules
We will split up the logic in a Runtime and a Editor module.
Everything that has to do with the actual data will be in the runtime module and everything that has to do with the creation and editor looks of it will be in a editor module:

`YourPlugin.uplugin`
```{
  "FileVersion": 1,
  "Version": 1,
  "VersionName": "1.0",
  "Modules": [
    {
      "Name": "YourRuntimeModule",
      "Type": "Runtime",
      "LoadingPhase": "Default"
    },
    {
      "Name": "YourEditorModule",
      "Type": "Editor",
      "LoadingPhase": "Default"
    }
  ],
  "FriendlyName": "YourPlugin",
  "Description": ".",
  "Category": "",
  "CreatedBy": "Xander",
  "CreatedByURL": "",
  "DocsURL": "",
  "MarketplaceURL": "",
  "SupportURL": "",
  "CanContainContent": "false",
  "Installed": false,
  "IsBetaVersion": false,
  "Plugins": [ ]
}
```

## Actual Instanced Data
This is the data that we would like to be instanced, This goes in our runtime module.

``` c++
UCLASS(Abstract, BlueprintType, Blueprintable, EditInlineNew, CollapseCategories, NotPlaceable, meta = (DontUseGenericSpawnObject, DataOnly))
class UMyDataObject : public UObject
{
    GENERATED_BODY()
public:
UPROPERTY(EditAnywhere)
FVector MyVector;
}
```


## Creating a Cusotm asset for it

### Blueprint Wrapper
Our Blueprint wrapper will be the Instanced blueprint that will be created that is wrapped around our `MyDataObject`.

This also goes in the runtime module


``` c++
//Class used to wrap our UMyDataObject with
UCLASS(BlueprintType, Blueprintable, EditInlineNew, CollapseCategories, NotPlaceable, meta = (DontUseGenericSpawnObject, DataOnly))
class YOUR_API UMyDataObjectBlueprint : public UBlueprint 
{
	GENERATED_BODY()
public:
	UMyDataObjectBlueprint(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
	{}

#if WITH_EDITOR
	virtual bool SupportedByDefaultBlueprintFactory() const override
	{
		return false;
	}
#endif
```

### Blueprint Factories

We will create a factory that knows how to create our `MyDataObject` and wraps it in a `UMyDataObjectBlueprint` that gets compiled

This goes in the editor module

``` c++
UCLASS(hidecategories = Object, CollapseCategories,  MinimalAPI)
class UMyDataObjectFactory : public UFactory
{
	GENERATED_UCLASS_BODY()
public:

	// The type of blueprint that will be created
	UPROPERTY(EditAnywhere)
	TEnumAsByte<enum EBlueprintType> BlueprintType = BPTYPE_Normal;

	// The parent class of the created blueprint
	UPROPERTY(EditAnywhere)
	TSubclassOf<class UMyDataObject> ParentClass;
	
	virtual UObject* FactoryCreateNew(UClass* Class, UObject* InParent, FName Name, EObjectFlags Flags, UObject* Context, FFeedbackContext* Warn, FName CallingContext) override;
	
    virtual UObject* FactoryCreateNew(UClass* Class, UObject* InParent, FName Name, EObjectFlags Flags, UObject* Context, FFeedbackContext* Warn) override;
};



UMyDataObjectFactory::UMyDataObjectFactory(const FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer)
{
	bCreateNew = true;
	bEditAfterNew = true;
	SupportedClass = UMyDataObjectBlueprint::StaticClass();
	ParentClass = UMyDataObject::StaticClass();
}


UObject* UMyDataObjectFactory::FactoryCreateNew(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, FFeedbackContext* Warn, FName CallingContext)
{
	// Make sure we are trying to factory a blueprint, then create and init one
	check(InClass->IsChildOf(UMyDataObjectBlueprint::StaticClass()));


	// If they selected an interface, force the parent class to be UInterface
	if (BlueprintType == BPTYPE_Interface)
	{
		ParentClass = UInterface::StaticClass();
	}

	if ((ParentClass == NULL) || !FKismetEditorUtilities::CanCreateBlueprintOfClass(ParentClass) || !ParentClass->IsChildOf(UMyDataObject::StaticClass()))
	{
		FFormatNamedArguments Args;
		Args.Add(TEXT("ClassName"), (ParentClass != NULL) ? FText::FromString(ParentClass->GetName()) : LOCTEXT("Null", "(null)"));
		FMessageDialog::Open(EAppMsgType::Ok, FText::Format(LOCTEXT("Cannot Create Blueprint", "Cannot create a Blueprint based on the class '{ClassName}'."), Args));
		return NULL;
	}
	else
	{
		UClass* BlueprintClass = nullptr;
		UClass* BlueprintGeneratedClass = nullptr;

		IKismetCompilerInterface& KismetCompilerModule = FModuleManager::LoadModuleChecked<IKismetCompilerInterface>("KismetCompiler");
		KismetCompilerModule.GetBlueprintTypesForClass(ParentClass, BlueprintClass, BlueprintGeneratedClass);

		return FKismetEditorUtilities::CreateBlueprint(ParentClass, InParent, InName, BlueprintType, UMyDataObjectBlueprint::StaticClass(), BlueprintGeneratedClass, CallingContext);
	}

	return NULL;
}

UObject* UMyDataObjectFactory::FactoryCreateNew(UClass* Class, UObject* InParent, FName Name, EObjectFlags Flags, UObject* Context, FFeedbackContext* Warn)
{
	return FactoryCreateNew(Class, InParent, Name, Flags, Context, Warn, NAME_None);
}
```

###  Blueprint Asset Type Actions
With this interface we can define how our asset will look, if it has a custom custom slate, what color the asset has, in what category it is .....


This goes in the editor module.


```cpp
class YOUR_API FAssetTypeActions_MyDataObject : public FAssetTypeActions_Blueprint
{
public:
	virtual FText GetName() const override;
	virtual FColor GetTypeColor() const override;
	virtual UClass* GetSupportedClass() const override;
	virtual uint32 GetCategories() override { return EAssetTypeCategories::Blueprint | EAssetTypeCategories::Gameplay; }

	//Used to do certain things or initialize things when we open up the editor for the object
	//virtual void OpenAssetEditor(const TArray<UObject*>& InObjects, TSharedPtr<class IToolkitHost> EditWithinLevelEditor = TSharedPtr<IToolkitHost>()) override;


	virtual UFactory* GetFactoryForBlueprintType(UBlueprint* InBlueprint) const override;

private:

	/** Returns true if the blueprint is data only */
	bool ShouldUseDataOnlyEditor(const UBlueprint* Blueprint) const;
};
```


```cpp
#define LOCTEXT_NAMESPACE "AssetTypeActions"

FText FAssetTypeActions_MyDataObject::GetName() const
{
	return NSLOCTEXT("AssetTypeActions", "AssetTypeActions_MyDataObjectBlueprint", "My Data Object Blueprint");
}

FColor FAssetTypeActions_MyDataObject::GetTypeColor() const
{
	return FColor::FromHex("#C9A0DCFF");
}

UClass* FAssetTypeActions_MyDataObject::GetSupportedClass() const
{
	return UMyDataObjectBlueprint::StaticClass();
}

UFactory* FAssetTypeActions_MyDataObject::GetFactoryForBlueprintType(UBlueprint* InBlueprint) const
{
	UMyDataObjectFactory* MyDataObjectFactory = NewObject<UMyDataObjectFactory>();
	MyDataObjectFactory->ParentClass = TSubclassOf<UMyDataObject>(*InBlueprint->GeneratedClass);
	return MyDataObjectFactory;
}

bool FAssetTypeActions_MyDataObject::ShouldUseDataOnlyEditor(const UBlueprint* Blueprint) const
{
	return FBlueprintEditorUtils::IsDataOnlyBlueprint(Blueprint)
		&& !FBlueprintEditorUtils::IsLevelScriptBlueprint(Blueprint)
		&& !FBlueprintEditorUtils::IsInterfaceBlueprint(Blueprint)
		&& !Blueprint->bForceFullEditor
		&& !Blueprint->bIsNewlyCreated;
}
#undef LOCTEXT_NAMESPACE
```




### Registering the Asset
Now we have created everything thats neeeded, We just need to let unreal know, Hey this is a asset that you can create.


Therefore we add a little bit of code to our `YourPluginEditorModule.cpp` to register and unregister it on startup/destroy.

```cpp
IMPLEMENT_MODULE(FYourPluginEditorModule, YourPluginEditorModule);

void FYourPluginEditorModule::StartupModule()
{
	//Stored in the header
	MyDataObjectAsset = MakeShareable(new FAssetTypeActions_MyDataObject);

	if (FModuleManager::Get().IsModuleLoaded("AssetTools"))
	{
		IAssetTools& AssetTools = FModuleManager::GetModuleChecked<FAssetToolsModule>("AssetTools").Get();
		AssetTools.RegisterAssetTypeActions(MyDataObjectAsset.ToSharedRef());
	}

	IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();
	AssetTools.RegisterAssetTypeActions(MyDataObjectAsset.ToSharedRef());
}

void FYourPluginEditorModule::ShutdownModule()
{
	if (FModuleManager::Get().IsModuleLoaded("AssetTools"))
	{
		IAssetTools& AssetTools = FModuleManager::GetModuleChecked<FAssetToolsModule>("AssetTools").Get();
		AssetTools.UnregisterAssetTypeActions(MyDataObjectAsset.ToSharedRef());
	}

	if (MyDataObjectAsset.IsValid()) 
	{
		// Release the shared pointer
		MyDataObjectAsset.Reset();
	}
}
```


## Final Result
Taadaaaa we have a data only `UBlueprint` object that just holds a `UObject`.
This can be really powerfull to setup data oriented systems and pass around as `TSoftClassPtr`.


![My image2](/assets/images/image-1.png)*My image2*
![My image](/assets/images/image.png) *My image*