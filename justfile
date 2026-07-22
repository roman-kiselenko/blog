@_default:
	just --list

system-info:
  @echo "This is an {{arch()}} machine".

run:
  docker run -it -p 8080:8080 -v $(pwd)/content:/app/content --rm blog

build-static:
  docker run -it -v $(pwd)/_site:/app/_site --rm blog pnpm build-ghpages

build:
  docker build -t blog .

