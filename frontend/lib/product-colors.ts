const colorSwatches = new Map([
  ["đen", "#252327"], ["black", "#252327"], ["trắng", "#fff"], ["white", "#fff"],
  ["trắng ngà", "#f8f4e7"], ["kem", "#f2e7cf"], ["be", "#d8bd9c"], ["beige", "#d8bd9c"],
  ["xám", "#8a898d"], ["ghi", "#8a898d"], ["gray", "#8a898d"], ["grey", "#8a898d"],
  ["bạc", "#bfc5cd"], ["nâu", "#76513c"], ["brown", "#76513c"], ["nâu đất", "#a07352"],
  ["đỏ", "#cc2438"], ["red", "#cc2438"], ["đỏ đô", "#822438"], ["burgundy", "#822438"],
  ["hồng", "#e497aa"], ["pink", "#e497aa"], ["tím", "#8c69ae"], ["purple", "#8c69ae"],
  ["cam", "#e7773a"], ["orange", "#e7773a"], ["vàng", "#f1cf4d"], ["yellow", "#f1cf4d"],
  ["xanh", "#5188bb"], ["xanh dương", "#3573bd"], ["blue", "#3573bd"], ["xanh biển", "#3573bd"],
  ["xanh da trời", "#9ecee9"], ["xanh navy", "#243754"], ["navy", "#243754"], ["xanh than", "#243754"],
  ["xanh lá", "#488752"], ["xanh lá cây", "#488752"], ["green", "#488752"],
  ["xanh rêu", "#657249"], ["olive", "#657249"], ["xanh ngọc", "#62b9ad"],
]);

export function getColorSwatch(color: string) {
  const value = color.trim().normalize("NFC").toLowerCase();
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/.test(value) ? value : colorSwatches.get(value);
}
