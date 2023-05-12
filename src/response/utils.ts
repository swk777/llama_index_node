export function* get_response_text(responseGen: Generator<string>) {
  let responseText = ''
  for (const response of responseGen) {
    responseText += response
  }
  return responseText
}
