---
title: Unreal Engine Improve Slate Creation
author: Xander Berten
layout: post
---


```cpp
BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION
END_SLATE_FUNCTION_BUILD_OPTIMIZATION
```

These defines just boil down to enabling disabling shipping build optimazations.


## Usage of the macro

```cpp
// MyCustomWidget.cpp
#include "MyCustomWidget.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBorder.h" // For SBorder
#include "Styling/CoreStyle.h"      // For FCoreStyle, or use FAppStyle

void SMyCustomWidget::Construct(const FArguments& InArgs)
{
    // --- Optimizations take a break from this point ---
    BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION

    ChildSlot
    [
        SNew(SBorder)
        .Padding(15.0f) // A little more padding for effect!
        .BorderImage(FAppStyle::GetBrush("Brushes.Panel")) // Example brush
        [
            SNew(STextBlock)
            .Text(NSLOCTEXT("MyUINamespace", "WelcomeText", "Slate Development Just Got Faster!"))
            .Font(FCoreStyle::Get().GetFontStyle("EmbossedText")) // Example font
        ]
    ];

    // --- And optimizations are back on! ---
    END_SLATE_FUNCTION_BUILD_OPTIMIZATION
}
```


## What Are These Macros Really Doing?

At their core, BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION and END_SLATE_FUNCTION_BUILD_OPTIMIZATION are like light switches for your compiler's optimization engine, but only for the chunk of code nestled between them.

    BEGIN_SLATE_FUNCTION_BUILD_OPTIMIZATION: This tells the compiler, "Hey, for this next bit of code, take it easy on the heavy-duty optimizations."
    END_SLATE_FUNCTION_BUILD_OPTIMIZATION: And this says, "Alright, you can go back to your usual optimization efforts now."

Under the hood, these macros typically expand to compiler-specific pragmas (like #pragma optimize( "", off ) for MSVC) that temporarily dial down the optimization level. The magic, however, lies in when they do this. It's often controlled by a preprocessor definition like UE_BUILD_OPTIMIZED_SLATE_FUNCTIONS. This flag is usually:

    Disabled (set to 0) in development and editor builds. This is when the macros actively turn off optimizations for the Slate code block.
    Enabled (set to 1) in shipping builds. Here, the macros effectively do nothing, letting your project's full optimization settings take charge for the final product.

## The Payoff: What This Means For Your Daily Grind

    During Development (Debug, Development Editor configurations):
        The Win: Compile times for your UI code can be noticeably reduced. This means less waiting and more doing, especially when you're iterating on widget layouts and designs. Your "change UI -> compile -> test" cycle becomes much tighter.
        The (Tiny) Trade-off: The machine code for these specific Slate construction blocks won't be as heavily optimized. But, as mentioned, this part of the code is usually not a runtime bottleneck during UI creation.

    For Shipping Builds:
        These macros gracefully step aside. Your Slate code, along with everything else, gets the full optimization treatment defined by your project's build configuration. This ensures your players get the best possible runtime performance.