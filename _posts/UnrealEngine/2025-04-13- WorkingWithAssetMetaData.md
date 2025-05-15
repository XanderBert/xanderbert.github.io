---
title: Unreal Engine Working With Asset Meta Data
author: Xander Berten
layout: post
---

# Working with Asset Meta Data
You'll need to add "AssetRegistry" to your project's *.Build.cs file if it's not already there (PublicDependencyModuleNames.AddRange(new string[] { ..., "AssetRegistry" });).



## Reading Asset Meta Data

``` c++
FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");

FSoftObjectPath ClassPath = newCameraSettings.ToSoftObjectPath();

// Strip the _C suffix
FString AssetPathStr = ClassPath.ToString();
AssetPathStr = AssetPathStr.Replace(TEXT("_C"), TEXT(""));

FAssetData AssetData = AssetRegistryModule.Get().GetAssetByObjectPath(*AssetPathStr);

if (AssetData.IsValid())
{
	// Try grabbing tags
	FString ParentClass;
	AssetData.GetTagValue("ParentClass", ParentClass);

	FString GeneratedClass;
	AssetData.GetTagValue("GeneratedClass", GeneratedClass);

	UE_LOG(LogTemp, Log, TEXT("Blueprint Parent Class: %s"), *ParentClass);
	UE_LOG(LogTemp, Log, TEXT("Generated Class: %s"), *GeneratedClass);

	// You can also get things like asset name, package path
	UE_LOG(LogTemp, Log, TEXT("Asset Name: %s"), *AssetData.AssetName.ToString());
	UE_LOG(LogTemp, Log, TEXT("Package Path: %s"), *AssetData.PackageName.ToString());
}
```


## Adding Custom Meta Data

There are several ways to add custom metadata to your assets in Unreal Engine, which can then be queried using the Asset Registry. The method you choose depends on whether you're defining new asset types or adding metadata to existing ones. The key principle is that the metadata needs to be exposed by the asset itself, and then the Asset Registry will pick it up when the asset is saved or scanned.

### Method 1: Using AssetUserData (Recommended for Existing Assets)

The most flexible way to attach arbitrary custom metadata to any existing UObject asset (like Blueprints, Textures, Materials, etc.) without modifying their original class is by using the AssetUserData array. Each UObject can hold an array of UAssetUserData instances. You can create a custom class derived from UAssetUserData to store your metadata and then override its GetAssetRegistryTags method to expose this data to the Asset Registry.

#### Step 1: Create a Custom UAssetUserData Class

First, define a C++ class that will hold your custom metadata and provide it to the Asset Registry.

MyCustomAssetMetadata.h
```C++

#pragma once

#include "CoreMinimal.h"
#include "Engine/AssetUserData.h"
#include "AssetRegistry/AssetRegistryTag.h" // Required for FAssetRegistryTag
#include "MyCustomAssetMetadata.generated.h"

UCLASS(BlueprintType) // Make it Blueprintable if you want to add/manipulate via Blueprints too
class YOURPROJECT_API UMyCustomAssetMetadata : public UAssetUserData
{
    GENERATED_BODY()

public:
    // This map will store our custom key-value pairs.
    // Mark it UPROPERTY so it gets serialized and is accessible.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Custom Metadata")
    TMap<FName, FString> CustomTags;

    // Override to provide these tags to the Asset Registry
    virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const override;

#if WITH_EDITORONLY_DATA
    // Optional: Also provide tags to be displayed in the asset audit window or other editor UIs
    // This ensures your custom tags are visible in places like the Reference Viewer or Size Map.
    virtual void GetAssetRegistryTagsForEditor(TArray<FAssetRegistryTag>& OutTags) const override;
#endif
};
```

MyCustomAssetMetadata.cpp
```C++

#include "MyCustomAssetMetadata.h" // Assuming this is in your project's Source/<YourProjectName>/ folder

void UMyCustomAssetMetadata::GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const
{
    Super::GetAssetRegistryTags(OutTags); // Important to call the parent implementation

    for (const auto& TagPair : CustomTags)
    {
        // Add each tag from our map.
        // FAssetRegistryTag::TT_Alphabetical is common for string values.
        // Other types include TT_Numerical, TT_Chronological, TT_Dimensional.
        OutTags.Add(FAssetRegistryTag(TagPair.Key, TagPair.Value, FAssetRegistryTag::TT_Alphabetical));
    }
}

#if WITH_EDITORONLY_DATA
void UMyCustomAssetMetadata::GetAssetRegistryTagsForEditor(TArray<FAssetRegistryTag>& OutTags) const
{
    // By default, AssetUserData tags might not be shown in some editor views (like Asset Audit)
    // unless also added here or if the UAssetUserData itself is marked to expose tags to editor.
    // Calling the same logic ensures they are visible.
    GetAssetRegistryTags(OutTags); 
    // Alternatively, you could call Super::GetAssetRegistryTagsForEditor(OutTags);
    // if UAssetUserData had its own editor-specific tags you wanted to include.
}
#endif
```


### Step 2: Add Custom Metadata to an Assets

Here's an example function demonstrating how you can load an asset, add your custom UMyCustomAssetMetadata object to it, populate some tags, and then save the asset.
```C++

// Required includes for this function:
#include "Engine/AssetUserData.h"         // For UAssetUserData
#include "MyCustomAssetMetadata.h"        // Your custom class defined above
#include "AssetRegistry/AssetRegistryModule.h" // For Asset Registry operations
#include "UObject/SavePackage.h"          // For FSavePackageArgs and UPackage::SavePackage
#include "SourceControlHelpers.h"         // For FSourceControlHelpers::PackageFilename (ensure "SourceControl" module is a dependency)
#include "Misc/PackageName.h"             // For FPackageName::LongPackageNameToFilename

// Function to add or update custom metadata on a specified asset
// AssetPath should be the object path, e.g., "/Game/MyFolder/MyBlueprintAsset.MyBlueprintAsset"
bool AddOrUpdateCustomMetadataToAsset(const FString& AssetPath, const FName& TagKey, const FString& TagValue)
{
    if (AssetPath.IsEmpty() || TagKey.IsNone())
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadataToAsset: Invalid AssetPath or TagKey provided."));
        return false;
    }

    // 1. Load the asset object
    // Using StaticLoadObject which is fine for editor utilities.
    // Ensure the path is the object path, not just the package path.
    UObject* LoadedAsset = StaticLoadObject(UObject::StaticClass(), nullptr, *AssetPath);
    if (!LoadedAsset)
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadataToAsset: Failed to load asset at path: %s"), *AssetPath);
        return false;
    }

    // 2. Find an existing instance of our metadata object or create a new one
    UMyCustomAssetMetadata* MetadataObject = nullptr;

    // Check if AssetUserData of our custom type already exists on the asset
    TArray<UAssetUserData*> ExistingUserDataArray = LoadedAsset->GetAssetUserDataArray();
    for (UAssetUserData* UserData : ExistingUserDataArray)
    {
        if (UserData && UserData->IsA<UMyCustomAssetMetadata>())
        {
            MetadataObject = Cast<UMyCustomAssetMetadata>(UserData);
            break;
        }
    }

    // If no existing metadata object of our type was found, create a new one
    if (!MetadataObject)
    {
        // Create the new UMyCustomAssetMetadata object, outer_ed to the loaded asset
        MetadataObject = NewObject<UMyCustomAssetMetadata>(LoadedAsset, UMyCustomAssetMetadata::StaticClass());
        if (!MetadataObject)
        {
            UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadataToAsset: Failed to create UMyCustomAssetMetadata for asset: %s"), *AssetPath);
            return false;
        }
        // Add the new metadata object to the asset's AssetUserData array
        LoadedAsset->AddAssetUserData(MetadataObject);
        UE_LOG(LogTemp, Log, TEXT("AddOrUpdateCustomMetadataToAsset: Added new UMyCustomAssetMetadata to asset: %s"), *AssetPath);
    }

    // 3. Add or update the specific tag in our metadata object's CustomTags map
    MetadataObject->CustomTags.FindOrAdd(TagKey) = TagValue;
    UE_LOG(LogTemp, Log, TEXT("AddOrUpdateCustomMetadataToAsset: Set tag '%s' to '%s' on asset: %s"), *TagKey.ToString(), *TagValue, *AssetPath);

    // 4. Mark the asset's package as dirty and save it to persist the changes
    UPackage* AssetPackage = LoadedAsset->GetOutermost();
    if (AssetPackage)
    {
        // Mark the package as needing to be saved
        AssetPackage->MarkPackageDirty();

        FString PackageFileName = FPackageName::LongPackageNameToFilename(AssetPackage->GetName(), FPackageName::GetAssetPackageExtension());
        
        FSavePackageArgs SaveArgs;
        SaveArgs.TopLevelFlags = EObjectFlags::RF_Public | EObjectFlags::RF_Standalone;
        SaveArgs.SaveFlags = SAVE_NoError; // Add other flags like SAVE_Async if needed, though for single operations sync is often fine.
        SaveArgs.bForceByteSwapping = false;
        SaveArgs.bWarnOfLongFilename = true;

        // Save the package to disk
        bool bSaved = UPackage::SavePackage(AssetPackage, LoadedAsset, *PackageFileName, SaveArgs);

        if (bSaved)
        {
            UE_LOG(LogTemp, Log, TEXT("AddOrUpdateCustomMetadataToAsset: Successfully saved asset package %s with updated metadata."), *PackageFileName);

            // Optional: Inform the Asset Registry that this asset has been updated.
            // This can help if you need to query the registry immediately and see the changes.
            // Often, the save itself is enough for the registry to pick it up during its next scan or via file watchers.
            FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
            TArray<FAssetData> AssetDataSet;
            AssetDataSet.Add(AssetRegistryModule.Get().GetAssetByObjectPath(FSoftObjectPath(AssetPath)));
            AssetRegistryModule.Get().AssetsUpdatedDuringAssetRegistryScan(AssetDataSet); // A more direct way to signal an update for specific assets

            return true;
        }
        else
        {
            UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadataToAsset: Failed to save package for asset: %s. Check logs for details (e.g. write permissions, source control)."), *PackageFileName);
        }
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("AddOrUpdateCustomMetadataToAsset: Could not get package for asset: %s"), *AssetPath);
    }

    return false;
}
```
Usage Example (e.g., in an Editor Utility Blueprint or C++ Editor Module):

```C++

// Example of calling the function:
FString MyBlueprintPath = TEXT("/Game/Blueprints/MyAwesomeBlueprint.MyAwesomeBlueprint"); // Use the object path
FName CustomTagKey = TEXT("ReviewStatus");
FString CustomTagValue = TEXT("Approved");

if (AddOrUpdateCustomMetadataToAsset(MyBlueprintPath, CustomTagKey, CustomTagValue))
{
    UE_LOG(LogTemp, Log, TEXT("Custom metadata tag '%s' should now be set on asset '%s'."), *CustomTagKey.ToString(), *MyBlueprintPath);

    // To verify, you can use the reading code from your initial snippet:
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    // Give the Asset Registry a moment if the update was very recent, or rely on the AssetsUpdatedDuringAssetRegistryScan call.
    FAssetData AssetData = AssetRegistryModule.Get().GetAssetByObjectPath(FSoftObjectPath(MyBlueprintPath));
    if (AssetData.IsValid())
    {
        FString ReadValue;
        if (AssetData.GetTagValue(CustomTagKey, ReadValue))
        {
            UE_LOG(LogTemp, Log, TEXT("Verification - Tag '%s' successfully read back with value: '%s'"), *CustomTagKey.ToString(), *ReadValue);
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("Verification failed - Tag '%s' not found immediately. The Asset Registry might still be processing the update."), *CustomTagKey.ToString());
        }
    }
}
```
## Method 2: For Custom C++ Asset Types

If you are creating your own asset types by deriving C++ classes from UObject, you have more direct control. You can override the GetAssetRegistryTags virtual function within your custom asset class.

MyOwnAssetType.h
```C++

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "AssetRegistry/AssetRegistryTag.h" // For FAssetRegistryTag
#include "MyOwnAssetType.generated.h"

UCLASS(BlueprintType)
class YOURPROJECT_API UMyOwnAssetType : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "My Asset Details")
    FString ImportantNotes;

    // This property will automatically become a tag because of the 'AssetRegistrySearchable' meta tag.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "My Asset Details", meta=(AssetRegistrySearchable))
    int32 AssetVersion;

    // For more complex or dynamically generated tags:
    virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const override;
};

MyOwnAssetType.cpp
C++

#include "MyOwnAssetType.h" // Your custom asset header

void UMyOwnAssetType::GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const
{
    Super::GetAssetRegistryTags(OutTags); // Call parent implementation

    // Add a tag based on the ImportantNotes property
    if (!ImportantNotes.IsEmpty())
    {
        // Using GET_MEMBER_NAME_CHECKED is a safe way to get the FName of a property.
        OutTags.Add(FAssetRegistryTag(GET_MEMBER_NAME_CHECKED(UMyOwnAssetType, ImportantNotes), ImportantNotes, FAssetRegistryTag::TT_Alphabetical));
    }

    // The 'AssetVersion' property is automatically handled due to 'AssetRegistrySearchable'.
    // You can also add completely arbitrary, hardcoded, or calculated tags here:
    OutTags.Add(FAssetRegistryTag(FName("InternalProcessingID"), FString::FromInt(GetUniqueID()), FAssetRegistryTag::TT_Numerical));
}
```

When an instance of UMyOwnAssetType is saved, the tags provided by its GetAssetRegistryTags method (along with any AssetRegistrySearchable properties) will be collected and stored by the Asset Registry.


### Method 3: Using AssetRegistrySearchable on UProperties (C++ & Blueprints)

For individual properties within your C++ classes or Blueprint variables that you want to be easily searchable via the Asset Registry, you can use the AssetRegistrySearchable metadata specifier.

For C++ UPROPERTYs:
Add the AssetRegistrySearchable meta tag directly to your UPROPERTY declaration.

```C++
UCLASS()
class YOURPROJECT_API UMyGameConfigData : public UObject // Or UActorComponent, etc.
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Config", meta = (AssetRegistrySearchable))
    FString ConfigSetName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Config", meta = (AssetRegistrySearchable))
    bool bIsEnabledByDefault;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Config", meta = (AssetRegistrySearchable))
    float UpdateInterval;
};
```
When an asset containing this object (or an instance of a class with such properties, like a DataAsset) is saved, ConfigSetName, bIsEnabledByDefault, and UpdateInterval will become tags in the Asset Registry. The tag key will be the property name, and the value will be the property's current value for that asset instance.

For Blueprint Variables:
While there isn't a direct "AssetRegistrySearchable" checkbox for Blueprint variables in the editor UI, if a Blueprint inherits from a C++ class that has AssetRegistrySearchable properties, those properties (if exposed as Blueprint variables) will naturally be included. For variables defined purely within a Blueprint, making them Instance Editable is a prerequisite for them to be considered by some asset data gathering processes. However, for reliably adding arbitrary key-value metadata to Blueprints not directly tied to a C++ parent's AssetRegistrySearchable property, the AssetUserData method (Method 1) is generally more robust and explicit.
