export async function openPrivateFile(download) {
  const preview = window.open('about:blank', '_blank')
  if (!preview) throw new Error('Allow pop-ups to view your resume.')
  preview.opener = null
  try {
    const blob = await download()
    const objectUrl = URL.createObjectURL(blob)
    preview.location.replace(objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    preview.close()
    throw error
  }
}
