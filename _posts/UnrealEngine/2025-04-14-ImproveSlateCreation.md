---
title: Improve Slate Creation
description: Speed up compile times of large Slate Construct functions.
author: Xander Berten
layout: post
category: Unreal Engine
---

Slate layouts are built with deeply nested, template-heavy code (`SNew`, `SAssignNew`, slot operators, ...). With optimizations enabled, the compiler can spend a surprisingly long time on a single big `Construct` function. Unreal provides two macros to help with that:

```cpp
BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION
END_SLATE_FUNCTION_BUILD_OPTIMIZATION
```

These macros turn compiler optimizations **off** for the code between them, which makes that code compile much faster.

## Usage

Put the macros **around** the whole function, not inside it:

```cpp
// SMyCustomWidget.cpp
#include "SMyCustomWidget.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBorder.h"
#include "Styling/AppStyle.h"

BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION

void SMyCustomWidget::Construct(const FArguments& InArgs)
{
    ChildSlot
    [
        SNew(SBorder)
        .Padding(15.0f)
        .BorderImage(FAppStyle::GetBrush("Brushes.Panel"))
        [
            SNew(STextBlock)
            .Text(NSLOCTEXT("MyUINamespace", "WelcomeText", "Slate Development Just Got Faster!"))
        ]
    ];
}

END_SLATE_FUNCTION_BUILD_OPTIMIZATION
```

> Don't place the macros inside a function body. They expand to `#pragma optimize` style directives, and MSVC only accepts those **outside** of functions (inside a function you get *error C2156: pragma must be outside function*). This is also how the engine itself uses them.
{: .block-warning }

## What are these macros really doing?

They act like a light switch for the compiler's optimizer, but only for the code in between:

- `BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION` — "for the next bit of code, skip the heavy optimizations."
- `END_SLATE_FUNCTION_BUILD_OPTIMIZATION` — "go back to the normal optimization settings."

Under the hood they expand to the engine's disable/enable optimization macros (for example `UE_DISABLE_OPTIMIZATION_SHIP` / `UE_ENABLE_OPTIMIZATION_SHIP` in recent versions), which in turn become compiler-specific pragmas like `#pragma optimize("", off)` on MSVC.

> The exact definition has changed between engine versions. If you want to know what they do in your version, look them up in `SlateGlobals.h` in the SlateCore module.
{: .block-info }

## Why is this okay?

Optimizing code makes it *run* faster, but it also makes it *compile* slower. For Slate construction code that trade-off is usually not worth it:

- **Faster iteration:** compile times for your UI code can drop noticeably, so your *change UI → compile → test* loop gets tighter.
- **Negligible runtime cost:** `Construct` runs once when the widget is created. It is almost never a performance bottleneck, so unoptimized machine code for it doesn't matter.

> Only use these macros for **construction** code. Don't wrap code that runs every frame, like `OnPaint`, `Tick` or `ComputeDesiredSize`, because there the missing optimizations *will* cost you performance.
{: .block-tip }
