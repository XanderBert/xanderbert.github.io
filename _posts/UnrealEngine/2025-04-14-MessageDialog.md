---
title: Message Dialog
description: Show a native pop-up dialog from C++ with FMessageDialog.
author: Xander Berten
layout: post
category: Unreal Engine
---

`FMessageDialog` opens a native, modal pop-up window. It is handy in editor tools to inform the user or ask for confirmation.

## Showing a dialog

```cpp
#include "Misc/MessageDialog.h"

FMessageDialog::Open(EAppMsgType::Ok, FText::FromString(TEXT("Hello Unreal")));
```

## Reading the result

`Open` returns an `EAppReturnType::Type` that tells you which button the user clicked:

```cpp
const EAppReturnType::Type Result = FMessageDialog::Open(
    EAppMsgType::YesNo,
    NSLOCTEXT("MyTool", "DeleteConfirm", "Are you sure you want to delete these assets?"));

if (Result == EAppReturnType::Yes)
{
    // Delete the assets
}
```

## Message types

These are the button combinations you can pass as the first argument:

```cpp
namespace EAppMsgType
{
    /**
     * Enumerates supported message dialog button types.
     */
    enum Type
    {
        Ok,
        YesNo,
        OkCancel,
        YesNoCancel,
        CancelRetryContinue,
        YesNoYesAllNoAll,
        YesNoYesAllNoAllCancel,
        YesNoYesAll,
    };
}
```

> The dialog is **modal**: it blocks the calling thread until the user closes it. Only call it from the game thread, and never in code that can run on a server or in an unattended build (commandlets, automation tests), because nobody will be there to click the button.
{: .block-warning }

> Use `FText` created with `NSLOCTEXT`/`LOCTEXT` instead of `FText::FromString` for text that users will see, so it can be localized.
{: .block-tip }
