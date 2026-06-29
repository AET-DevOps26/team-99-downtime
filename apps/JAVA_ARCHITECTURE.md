# Java backend architecture

how a jvm service (`apps/<name>-service`) is built. read first. know where code lives,
where new code goes. change the shape? update this file in the same commit. keep it true.
this is the standard for EVERY java service. copy it, don't reinvent per service.

## Tree

```
apps/<name>-service/src/main/java/.../<name>/
  <Name>ServiceApplication.java   spring boot entry. wiring only, nothing else.
  web/          http edge. controllers + the exception handler. talks http, nothing more.
  dto/          shapes that cross the http edge. request in, response out. plain records.
  service/      the brain. business logic. knows nothing about http.
  domain/       the things themselves. jpa entities + domain exceptions.
  repository/   data. spring-data interfaces. the only place that touches the db.
```

`budget-service` is the real example. copy its shape for new services.
shared stuff (security, the `/{prefix}/me` probe) lives once in `commons-jvm` — depend on it, don't copy it.

## Where does my file go?

ask one thing: does it **handle http / hold logic / persist / model the thing**?
→ `web` / `service` / `repository` / `domain`. done.
a shape that crosses the http edge → `dto`.

## What each part does

- **web/** — controllers. map a url to a service call. pull the user from the jwt
  (`jwt.getSubject()` is the `userId`), never from the body. no logic, no db.
  the `GlobalExceptionHandler` lives here — it turns exceptions into status codes.
  `CategoryController.java` is this.
- **dto/** — request + response records. the api contract. the wire never sees an
  entity. `CategoryRequest` (in, holds the `@Valid` rules), `CategoryResponse` (out, has `from(entity)`).
- **service/** — the brain. one method per use case. scopes everything by `userId`.
  throws plain domain exceptions, never http types. `CategoryService.java` is this.
- **domain/** — the entity (`Category`) and its exceptions (`CategoryNotFoundException`).
  knows nothing about the other layers.
- **repository/** — `JpaRepository` interfaces. queries scoped by `userId`
  (`findByUserId`, `findByIdAndUserId`). the ONLY place queries live.
- **<Name>ServiceApplication** — boot entry. wiring only. no logic.

## Why it's split this way (the 3 laws)

- **data ≠ logic ≠ domain.** layers, never mixed.
  - data = `repository/` (talks to db). logic = `service/` (the brain). edge = `web/` + `dto/` (talks http).
  - swap one without touching the others. new query? `repository/` only. new api
    shape? `dto/` only. same brain.
- **SRP — one file, one job.** controller maps http. service decides. repository fetches.
  a service that also builds json is two jobs → split. can't say its job in one line? too big.
- **open/closed — add, don't edit.** new endpoint = new method. new error = new domain
  exception + one handler method. don't bolt branches onto working code.

## Flow (how a request works)

request → controller (`web`, reads the jwt) → service (`logic`) → repository (`data`) → entity (`domain`).
back out: service returns the entity, controller maps it to a `dto`. errors bubble up as
domain exceptions; the handler turns them into 400 / 404 / 409.

## Rules

- deps go DOWN only: `web → service → repository/domain`. `dto` sits at the edge.
- `userId` comes from the jwt, never the body or a path param. scope every query by it.
- controller never takes or returns an entity. only `dto`.
- service throws domain exceptions. only `web` knows http status codes.
- only `repository/` touches the db. one service = one database, no cross-service queries.
- shared security lives in `commons-jvm`. a new service wires it with a dep + two
  `application.yaml` values (see [AUTHENTICATION.md](../docs/development/AUTHENTICATION.md)). don't copy security code.
- build/test with `bun nx` and the `:<service>` path, not raw gradle.

## FORBIDDEN (do not do this)

- ❌ entity in a controller signature (in or out). leaks the db into the api. use `dto`.
- ❌ business logic in a controller. → `service`.
- ❌ http types in a service (`ResponseStatusException`, `HttpStatus`, `ResponseEntity`).
  throw a domain exception, map it in `web`.
- ❌ sql / `@Query` / entity-manager outside `repository/`.
- ❌ reading another service's tables or db. call its api.
- ❌ trusting a `userId` from the body or path. it comes from the jwt.
- ❌ a `util` / `helpers` / `common` grab-bag package. name by job.
- ❌ logic in `<Name>ServiceApplication`. it is wiring.

## New service

1. `apps/<name>-service/` from the budget-service shape (gradle + nx + Dockerfile).
2. depend on `commons-jvm`, add the two `application.yaml` auth values. every route is secured by default.
3. make the packages: `web/ dto/ service/ domain/ repository/`.
4. its own database only (`<name>_db`), wired via env in `docker-compose.yaml`.

## New endpoint

1. `dto/` — request (+ `@Valid` rules) and response shapes.
2. `domain/` — entity + any new exception.
3. `repository/` — the user-scoped query.
4. `service/` — the use case. scope by `userId`. throw domain exceptions.
5. `web/` — map the route, read the jwt, return a `dto`. add a handler method for any new exception.
