function safeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "") || crypto.randomUUID();
}

export function designFilePath(userId: string, designId: string, fileId: string, extension = "png") {
  return `${safeSegment(userId)}/designs/${safeSegment(designId)}/files/${safeSegment(fileId)}.${safeSegment(extension)}`;
}

export function designLibraryPath(userId: string, kind: "design" | "clipart", itemId: string, extension = "png") {
  return `${safeSegment(userId)}/library/${kind === "design" ? "designs" : "cliparts"}/${safeSegment(itemId)}.${safeSegment(extension)}`;
}

export function designPreviewPath(userId: string, designId: string, extension = "png") {
  return `${safeSegment(userId)}/designs/${safeSegment(designId)}/preview.${safeSegment(extension)}`;
}
