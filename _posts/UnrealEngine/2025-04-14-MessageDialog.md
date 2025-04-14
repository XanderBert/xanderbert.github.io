---
title: Unreal Engine Message Dialog
author: Xander Berten
layout: post
---


``` c++
FMessageDialog::Open( EAppMsgType::Ok, FText::Format( LOCTEXT("CannotCreateAnimBlueprint", "Cannot create an Anim Blueprint based on the class '{ClassName}'."), Args ) );
```