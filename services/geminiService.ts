/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash-image-preview';

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = `You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for a high-end e-commerce website.

**Crucial Rules:**
1.  **Clothing:** Dress the person in a simple, plain, form-fitting heather grey t-shirt and black shorts. On the t-shirt, place a small, subtle, black 'closet.city' logo on the left chest area. This is their base outfit.
2.  **Background:** The background must be a clean, neutral studio backdrop (light gray, #f0f0f0).
3.  **Pose & Expression:** The person should have a neutral, professional model expression and be in a standard, relaxed standing model pose.
4.  **Preserve Identity:** Preserve the person's identity, unique features, and body type from the original photo.
5.  **Photorealism:** The final image must be photorealistic.
6.  **Output:** Return ONLY the final image.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `You are an expert virtual try-on AI with a deep understanding of fashion and physics. You will be given a 'model image' which shows a person already wearing an outfit, and a 'garment image' which shows a single piece of clothing. Your task is to create a new, photorealistic image where the person from the 'model image' is now wearing the new garment layered realistically on top of their current outfit.

**Crucial Rules:**
1.  **Strict Layering Logic:** The new garment from the 'garment image' MUST be added on top of the clothes already present in the 'model image'. Think of this as adding a new layer. Do NOT replace, remove, or alter the existing clothing, only cover it where the new garment would naturally occlude it. For example, a sweatshirt goes OVER a t-shirt.
2.  **Physical Realism:** The new garment must conform to the model's body and pose with extreme realism. This includes:
    *   **Folds & Creases:** Generate natural folds and creases where the fabric would bunch or stretch.
    *   **Shadows & Lighting:** The new garment must cast realistic shadows on the clothing underneath it and on the model's body. It must also receive shadows from the environment and the model, consistent with the lighting in the 'model image'.
    *   **Occlusion:** The new garment must correctly cover parts of the underlying clothes and body.
3.  **Preserve the Model:** The person's identity, face, hair, body shape, and pose from the 'model image' MUST remain absolutely unchanged.
4.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly. No part of the background should be altered.
5.  **Output:** Return ONLY the final, edited image. Do not include any text, descriptions, or explanations.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};