---
title: Working With Asset Meta Data
description: Read asset tags from the Asset Registry without loading assets, and expose your own tags.
author: Xander Berten
layout: post
category: Unreal Engine
---

The **Asset Registry** keeps a small set of key/value *tags* for every asset in your project. The big advantage: you can read those tags **without loading the asset**. That makes them perfect for things like filtering, searching or building tools that need to look at hundreds of assets at once.

## Setup

Add `AssetRegistry` to your module's `.Build.cs` if it's not already there:

```cs
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "AssetRegistry" });
```

## Reading asset meta data

```cpp
#include "AssetRegistry/AssetRegistryModule.h"

void LogBlueprintInfo(const TSoftClassPtr<UObject>& BlueprintClass)
{
    IAssetRegistry& AssetRegistry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry").Get();

    // A Blueprint *class* path looks like  /Game/BP_Camera.BP_Camera_C
    // The Blueprint *asset* path looks like /Game/BP_Camera.BP_Camera
    // The registry stores the asset, so strip the _C suffix
    FString AssetPath = BlueprintClass.ToSoftObjectPath().ToString();
    AssetPath.RemoveFromEnd(TEXT("_C"));

    FAssetData AssetData = AssetRegistry.GetAssetByObjectPath(FSoftObjectPath(AssetPath));
    if (!AssetData.IsValid())
    {
        return;
    }

    // Read tags
    FString ParentClass;
    AssetData.GetTagValue("ParentClass", ParentClass);

    FString GeneratedClass;
    AssetData.GetTagValue("GeneratedClass", GeneratedClass);

    UE_LOG(LogTemp, Log, TEXT("Blueprint Parent Class: %s"), *ParentClass);
    UE_LOG(LogTemp, Log, TEXT("Generated Class: %s"), *GeneratedClass);

    // FAssetData also has general info like the asset name and package
    UE_LOG(LogTemp, Log, TEXT("Asset Name: %s"), *AssetData.AssetName.ToString());
    UE_LOG(LogTemp, Log, TEXT("Package Name: %s"), *AssetData.PackageName.ToString());
}
```

> Use `RemoveFromEnd` instead of `Replace(TEXT("_C"), TEXT(""))`. `Replace` removes **every** `_C` in the path, so an asset like `/Game/_Characters/BP_Camera_C` would end up pointing to the wrong place.
{: .block-warning }

> Want to see which tags an asset has? Hover over it in the Content Browser: the tooltip shows most of its registry tags.
{: .block-tip }

## Adding custom meta data

There are several ways to expose your own tags. The key principle is always the same: **the asset itself** has to report the tags, and the Asset Registry stores them when the asset is **saved** (or scanned from disk).

| Method | Best for |
|---|---|
| [1. `AssetRegistrySearchable` properties](#method-1-assetregistrysearchable-properties) | Your own classes, simple values |
| [2. Overriding `GetAssetRegistryTags`](#method-2-overriding-getassetregistrytags) | Your own asset types, computed values |
| [3. Asset User Data](#method-3-asset-user-data) | Attaching data to existing engine assets |

> Tags only update when the asset is **saved**. Changing a property in the editor without saving won't change what `FAssetData` returns.
{: .block-info }

### Method 1: AssetRegistrySearchable properties

The easiest option. Add the `AssetRegistrySearchable` meta specifier to a `UPROPERTY` and its value automatically becomes a tag. The tag key is the property name.

```cpp
UCLASS(Blueprintable)
class YOURPROJECT_API UMyGameConfigData : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config", AssetRegistrySearchable)
    FString ConfigSetName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config", AssetRegistrySearchable)
    bool bIsEnabledByDefault = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Config", AssetRegistrySearchable)
    float UpdateInterval = 1.0f;
};
```

Every saved `UMyGameConfigData` asset now has the tags `ConfigSetName`, `bIsEnabledByDefault` and `UpdateInterval`.

This also works for **Blueprints**: if a Blueprint's parent C++ class has `AssetRegistrySearchable` properties, the values from the Blueprint's defaults are exported as tags of the Blueprint asset.

> There is no *"Asset Registry Searchable"* checkbox for variables that are created purely in Blueprint. If you need searchable values on Blueprints, declare the property in a C++ parent class.
{: .block-info }

### Method 2: Overriding GetAssetRegistryTags

If you create your own asset types in C++, you can override `GetAssetRegistryTags` to add any tag you like, including values that are calculated.

`MyOwnAssetType.h`
```cpp
#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "MyOwnAssetType.generated.h"

UCLASS(BlueprintType)
class YOURPROJECT_API UMyOwnAssetType : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "My Asset Details")
    FString ImportantNotes;

    // Automatically becomes a tag because of AssetRegistrySearchable (Method 1)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "My Asset Details", AssetRegistrySearchable)
    int32 AssetVersion = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "My Asset Details")
    TArray<FName> Keywords;

    virtual void GetAssetRegistryTags(FAssetRegistryTagsContext Context) const override;
};
```

`MyOwnAssetType.cpp`
```cpp
#include "MyOwnAssetType.h"

void UMyOwnAssetType::GetAssetRegistryTags(FAssetRegistryTagsContext Context) const
{
    // Always call Super, it adds the AssetRegistrySearchable properties
    Super::GetAssetRegistryTags(Context);

    if (!ImportantNotes.IsEmpty())
    {
        // GET_MEMBER_NAME_CHECKED gives a compile error if the property is ever renamed
        Context.AddTag(FAssetRegistryTag(GET_MEMBER_NAME_CHECKED(UMyOwnAssetType, ImportantNotes), ImportantNotes, FAssetRegistryTag::TT_Alphabetical));
    }

    // Calculated tags are possible too
    Context.AddTag(FAssetRegistryTag(TEXT("KeywordCount"), FString::FromInt(Keywords.Num()), FAssetRegistryTag::TT_Numerical));
}
```

> The `FAssetRegistryTagsContext` signature was introduced in **UE 5.4**. In older versions, override `virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const` and use `OutTags.Add(...)` instead.
{: .block-info }

> Only use values that are **stable** between saves as tags. Something like `GetUniqueID()` changes every time the editor runs, so it's useless as meta data.
{: .block-warning }

The tag type (`TT_Alphabetical`, `TT_Numerical`, `TT_Chronological`, `TT_Dimensional`) tells the editor how to sort and display the value, for example in the Content Browser's column view.

### Method 3: Asset User Data

Sometimes you want to attach data to an asset whose class you **can't** change, like a Static Mesh or a Texture. Assets that implement `IInterface_AssetUserData` hold an array of `UAssetUserData` objects that are saved together with the asset. You can create your own subclass to store whatever you need.

> Tags are only gathered from the asset **itself**, not from its Asset User Data objects. Data stored this way is saved with the asset, but it won't show up in `FAssetData` unless the owning asset class forwards it in its own `GetAssetRegistryTags`. To read it, you have to load the asset.
{: .block-danger }

> Not every asset supports Asset User Data. Static Meshes, Skeletal Meshes, Textures, Materials and Actor Components do; **Blueprints don't**. For Blueprints, use Method 1.
{: .block-warning }

#### Step 1: Create a custom UAssetUserData class

`MyCustomAssetMetadata.h`
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Engine/AssetUserData.h"
#include "MyCustomAssetMetadata.generated.h"

UCLASS(BlueprintType)
class YOURPROJECT_API UMyCustomAssetMetadata : public UAssetUserData
{
    GENERATED_BODY()

public:
    // Our custom key/value pairs. UPROPERTY makes sure they are saved with the asset.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Custom Metadata")
    TMap<FName, FString> CustomTags;
};
```

#### Step 2: Add the meta data to an asset

This editor-only function loads an asset, adds (or updates) our `UMyCustomAssetMetadata`, and saves the asset.

```cpp
#include "MyCustomAssetMetadata.h"
#include "Interfaces/Interface_AssetUserData.h"
#include "FileHelpers.h" // UEditorLoadingAndSavingUtils, requires the "UnrealEd" module

// AssetPath is the object path, e.g. "/Game/Meshes/SM_Rock.SM_Rock"
bool AddOrUpdateCustomMetadata(const FString& AssetPath, FName TagKey, const FString& TagValue)
{
    if (AssetPath.IsEmpty() || TagKey.IsNone())
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadata: Invalid AssetPath or TagKey."));
        return false;
    }

    // 1. Load the asset
    UObject* LoadedAsset = LoadObject<UObject>(nullptr, *AssetPath);
    if (!LoadedAsset)
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadata: Failed to load asset: %s"), *AssetPath);
        return false;
    }

    // 2. Make sure the asset supports Asset User Data
    IInterface_AssetUserData* UserDataInterface = Cast<IInterface_AssetUserData>(LoadedAsset);
    if (!UserDataInterface)
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadata: %s doesn't support Asset User Data."), *AssetPath);
        return false;
    }

    // 3. Find our existing meta data object, or create a new one
    UMyCustomAssetMetadata* Metadata = Cast<UMyCustomAssetMetadata>(UserDataInterface->GetAssetUserDataOfClass(UMyCustomAssetMetadata::StaticClass()));
    if (!Metadata)
    {
        // The asset is the Outer, so the meta data is saved inside the asset's package
        Metadata = NewObject<UMyCustomAssetMetadata>(LoadedAsset, NAME_None, RF_Transactional);
        UserDataInterface->AddAssetUserData(Metadata);
    }

    // 4. Set the value
    LoadedAsset->Modify();
    Metadata->CustomTags.FindOrAdd(TagKey) = TagValue;

    // 5. Save the package so the change is persisted
    UPackage* Package = LoadedAsset->GetPackage();
    Package->MarkPackageDirty();

    const bool bSaved = UEditorLoadingAndSavingUtils::SavePackages({ Package }, /*bOnlyDirty*/ false);
    if (!bSaved)
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadata: Failed to save %s. Is the file read-only or checked out by someone else?"), *Package->GetName());
    }

    return bSaved;
}
```

#### Step 3: Read the meta data back

```cpp
FString ReadCustomMetadata(const FString& AssetPath, FName TagKey)
{
    UObject* Asset = LoadObject<UObject>(nullptr, *AssetPath);
    IInterface_AssetUserData* UserDataInterface = Cast<IInterface_AssetUserData>(Asset);
    if (!UserDataInterface)
    {
        return FString();
    }

    if (const UMyCustomAssetMetadata* Metadata = Cast<UMyCustomAssetMetadata>(UserDataInterface->GetAssetUserDataOfClass(UMyCustomAssetMetadata::StaticClass())))
    {
        if (const FString* Value = Metadata->CustomTags.Find(TagKey))
        {
            return *Value;
        }
    }

    return FString();
}
```

> Asset User Data can also be added by hand: select a Static Mesh, find **Asset User Data** in the details panel and add an entry of your class. No code needed to get started.
{: .block-tip }
