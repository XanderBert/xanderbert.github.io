---
title: Unreal Engine Message Dialog
author: Xander Berten
layout: post
---

### Calling a dialog
``` c++
FMessageDialog::Open(EAppMsgType::Ok, FText::FromString("Hello Unreal"));
```


### Message Types
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