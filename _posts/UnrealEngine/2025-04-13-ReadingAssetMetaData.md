---
title: Unreal Engine Reading Asset Meta Data
author: Xander Berten
layout: post
---


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