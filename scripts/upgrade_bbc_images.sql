-- BBC RSS publishes 240 px thumbnails, while the same image is available
-- at 1024 px from BBC's image service. Upgrade previously stored URLs.
update public.news_articles
set image = regexp_replace(image, '/ace/standard/240/', '/ace/standard/1024/')
where source = 'BBC News'
  and image like 'https://ichef.bbci.co.uk/ace/standard/240/%';
