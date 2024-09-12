---
title: "Screen Space Voxel Global Illumination: Part 1 - Voxelisation"
description: The first article in a series on implementing Voxel GI (Voxel Cone Tracing) in a real-time rendering engine.
date: 2024-09-12
external: false
---

## Introduction

Global Illumination is a technique in computer graphics in which we look to model the infinite number of light rays that bounce around a given scene, to provide indirect illumination, reflections, shadows and other effects such as translucency.

![A sample demonstrating some traslucent materials.](/img/translucent.jpeg)

Calculating an infinite number of light rays is a task reserved only for the world's most powerful super computers, and as such,
we must find a way to reduce the required number of samples to make this technique feasible in real-time.
Though recent strides have been made with the introduction of discrete ray tracing hardware in modern GPUs, Global Illumination (GI) remains an "unsolved" problem in the sense that no single implementation can offer high performance, good visual quality and reasonable memory usage at once.

![VXGI vs Raytracing.](/img/vxgi_vs_rt.png)

The above image compares Voxel GI (Left) against a reference Raytraced image (Right). Voxel GI loses fine grain resolution due to the fact that the scene must be discretised into a 3D texture (or voxel grid) in order for the final light pass to "trace" into. Raytracing does not have this problem as each ray is traced through the entire scene geometry again, meaning no resolution is lost in reflections or subsequent light bounces, though this does come with a huge performance penalty when compared to VXGI.

## Overview

In this first of 3 articles I plan to write up, I will detail how I went about implementing Voxel GI (Also known as Voxel Cone Tracing). The first article will deal with voxelisation, with the subsequent articles focussing tracing in to the voxel grid, and combining the indirect lighting image with the direct pass.

Something to be aware of is that my implementation deviates from most other implementations of VXGI as I am not directly rendering the scene into a 3D texture, which is typically done through the use of geometry shaders. Instead, we will be reprojecting the direct lighting pass into the 3D texture using the position + normal attachments of the gbuffer. This approach has benefits and drawbacks:

### Benefits

- Inertia - Most modern renderers have a deferred rendering setup, meaning get the voxelisation process integrated is much less challenging, as it can be performed on a pass of existing image buffers
- Fast - reprojecting into the 3D texturecan be done in a compute shader, with few texture samples required. As will be discussed later, the technique works best at a low-ish resolution to avoid pixel fighting, which also helps with dispatch time.
- No second draw pass to fill voxel texture
- No need for geometry shaders (Vulkan devs will appreciate this one)

### Downsides

- Screen Space - This should be self explanatory, but we can only reproject what is currently in the gbuffer or on the screen. Texels in the 3D texture that have previously been written can still be cast into, but if the state of the texel changes while the camera is not looking in that direction, the voxel grid will not reflect theses changes
- Pixel Fighting - As the voxel grid we use is low resolution due to memory constraints, we end up with texels flickering regularly, due to the fact that multiple gbuffer texels are fighting for the same texel with in the voxel texture
- Texture size - This is not specific to my implementation of VXGI but still worth highlighting, storing the voxel grid as a 3D texture is extremely memory intensive. For example, a 256x256x256 3D texture of type RGBA16F will occupy ~128mb of video memory. This may not sound too intense, but when you start to incorporate multiple voxel grids, on top of any models, textures etc. that are required to render the scene, it all adds up. There are solutions to this issue (namely using sparse voxels to avoid storing empty pixels) however these will not be explored in this series of articles,
- Low Resolution - Again not specifically a problem with this implementation of VXGI, but resolution is typically a limitting factor. Specular reflections / traced shadows tend to suffer in comparison to the raytraced equivalent as the voxel grid's resolution cannot capture the fine details in the same way ray tracing can.

## Ingredients

If any of the downsides are not deal breakers we can now look at how to start implementing this algorithm! Before we get started here are a list of "ingredients" you will need (elements of a rendering engine that we need for this to work):

- A GBuffer with a position and normal attachment
- Ability to dispatch compute shaders
- Decent discrete GPU (GTX 1060+, debugging on lower end hardware is possible but not fun)
