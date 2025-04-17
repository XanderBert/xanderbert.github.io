---
title: Unreal Engine Better Data Assets
author: Xander Berten
layout: post
---


## Instanced Data
There is no good way in unreal to have a Data Asset that is able to store Instanced Data.
Creating a data only `UObject` and passing that as a `TSoftClassPtr` does make it able to do that.

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


### Registering the Asset

###  Blueprint Asset Type Actions
`FAssetTypeActions_Blueprint`
