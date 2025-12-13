/**
 * Distributes an array in a round-robin manner to a specified number of columns
 * Example: [1,2,3,4,5,6,7] -> [[1,4,7], [2,5], [3,6]]
 * @param items The array to distribute
 * @param columns The number of columns
 * @returns A 2D array, where each sub-array represents a column
 */
export const distributeToColumns = <T>(items: T[], columns: number): T[][] => {
  const result: T[][] = Array.from({ length: columns }, () => []);

  items.forEach((item, index) => {
    const columnIndex = index % columns;
    result[columnIndex].push(item);
  });

  return result;
};
