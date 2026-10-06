const express = require('express');
const yaml = require( 'js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const CONFIG = process.argv.slice(2)[0] || 'config.yaml';

app.set('view engine', 'pug');

let config;

try {
  config = yaml.load(
    fs.readFileSync(path.join(__dirname, CONFIG), 'utf8')
  );
} catch (error) {
  console.error('Error reading or parsing config:', error);
  process.exit(1);
}

app.use(express.json());

function checkRoute(req, res, next) {
  const route = req.params.route;

  if (!config.routes.includes(route)) {
    return res.status(404).json({
      error: `Route ${route} not found`
    });
  }

  next();
}

app.get('/', (req, res) => {
  res.render('index', {
    title: "pets",
    config: config
  });
});

app.get('/:route', checkRoute, (req, res) => {
  const route = req.params.route;
  const { embed } = req.query;
  const data = config[route] || [];

  const info = getEmbedInfo(route, embed);
  if (!info) {
    return res.json(data);
  }

  res.json(data.map(item => embedRecord(item, info.relation, info.relatedData, embed)));
});

app.get('/:route/:id', checkRoute, (req, res) => {
  const route = req.params.route;
  const id = req.params.id;
  const { embed } = req.query;
  const data = config[route] || [];

  const record = data.find(item => item.id == id);

  if (!record) {
    return res.status(404).json({
      error: `Record with ID ${id} not found in ${route}`
    });
  }

  const info = getEmbedInfo(route, embed);
  if (!info) {
    return res.json(record);
  }

  res.json(embedRecord(record, info.relation, info.relatedData, embed));
});

function getEmbedInfo(route, embed) {
  const relations = config.relationships?.[route] || [];
  const relation = relations.find(r => r.foreignKey.replace("Ids", "") + "s" === embed);

  if (!relation) {
    return null;
  }

  const relatedData = config[relation.relatedRoute] || [];
  return { relation, relatedData };
}

function embedRecord(record, relation, relatedData, embed) {
  const keys = record[relation.foreignKey] || [];
  const records = []
  for (const key of keys) {
    const found = relatedData.find(item => item.id === key);
    if (found) records.push(found);
  }
  return {...record, [embed]: records};
}

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

const shutdown = () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
