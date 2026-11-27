let viewedProduct: { id: string; color: string } | undefined;

export function registerChatProduct(id: string, color: string) {
  const selection = { id, color };
  viewedProduct = selection;
  return () => {
    if (viewedProduct === selection) viewedProduct = undefined;
  };
}

export function readChatProductColor(id: string | undefined) {
  return id && viewedProduct?.id === id ? viewedProduct.color : undefined;
}
