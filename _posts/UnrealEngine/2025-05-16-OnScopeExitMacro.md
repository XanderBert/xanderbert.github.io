---
title: On Scope Exit Macro
author: Xander Berten
layout: post
---


You can pass a lambda in this macro that will fire when you go out of this scope.


This can be really handy if you have a lot of exit conditions so you can avoid to duplicate cleanup code.

```cpp
	ON_SCOPE_EXIT
	{
		LevelSequenceActor->MarkAsGarbage();
		LevelSequencePlayer->MarkAsGarbage();
	}

```
