---
title: Better Data Assets
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
FVector MyVector;
}
```


## Creating a Cusotm asset for it

### Blueprint Factories


###  Blueprint Asset Type Actions
`FAssetTypeActions_Blueprint`
