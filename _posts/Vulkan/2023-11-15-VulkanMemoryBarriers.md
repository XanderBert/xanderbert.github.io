---
title: Page with no cover image
author: Xander Berten
layout: post
---



# Vulkan Memory Barriers 
## What should you watch out for


Memory barriers should be grouped together as agressivly as possible. 
 Why is that? 

The driver could do some things when using memory barriers. 

Wait until idle and clearing the L2 Cache of the GPU.
