const groupItemsByKey = (items, key) => items.reduce(
    (result, item) => ({
        ...result,
        [item[key]]: [
        ...(result[item[key]] || []),
        item,
        ],
    }), 
    {},
);

exports.groupItemsByKey = groupItemsByKey;