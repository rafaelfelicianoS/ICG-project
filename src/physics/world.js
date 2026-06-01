import { BALL, COURT, PHYSICS } from "../core/constants.js";
import { CANNON } from "../core/deps.js";

function setBodyPosition(body, vec3) {
  body.position.set(vec3.x, vec3.y, vec3.z);
}

export function syncMeshWithBody(mesh, body) {
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
}

export function createPhysicsWorld(courtData) {
  const world = new CANNON.World();
  world.gravity.set(0, PHYSICS.gravity, 0);
  world.allowSleep = true; // objectos parados "adormecem" para poupar CPU
  world.broadphase = CANNON.SAPBroadphase ? new CANNON.SAPBroadphase(world) : new CANNON.NaiveBroadphase();
  world.solver.iterations = 12; // mais iterações = colisões mais precisas mas mais lentas

  const materials = {
    floor: new CANNON.Material("floor"),
    board: new CANNON.Material("board"),
    rim: new CANNON.Material("rim"),
    ball: new CANNON.Material("ball"),
  };

  // ContactMaterials: definem fricção e restituição (bounce) entre pares de superfícies
  world.addContactMaterial(
    new CANNON.ContactMaterial(materials.ball, materials.floor, { friction: 0.4, restitution: 0.75 }) // bola ressalta 75% no chão
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(materials.ball, materials.board, { friction: 0.28, restitution: 0.5 }) // tabuleiro absorve mais
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(materials.ball, materials.rim, { friction: 0.3, restitution: 0.6 }) // aro ressalta 60%
  );

  const floorBody = new CANNON.Body({ mass: 0, material: materials.floor });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floorBody.kind = "floor";
  world.addBody(floorBody);

  courtData.hoops.forEach((hoop) => {
    const backboardBody = new CANNON.Body({ mass: 0, material: materials.board });
    backboardBody.addShape(
      new CANNON.Box(new CANNON.Vec3(COURT.backboardWidth * 0.5, COURT.backboardHeight * 0.5, COURT.backboardDepth * 0.5))
    );
    backboardBody.position.set(hoop.backboardCenter.x, hoop.backboardCenter.y, hoop.backboardCenter.z);
    backboardBody.kind = "backboard";
    world.addBody(backboardBody);
  });

  const rimBodies = [];
  const segmentLength = (2 * Math.PI * COURT.rimRadius) / PHYSICS.rimSegments;

  // O aro circular é aproximado por 12 segmentos cilíndricos — Cannon.js não tem torus
  courtData.hoops.forEach((hoop) => {
    for (let i = 0; i < PHYSICS.rimSegments; i += 1) {
      const theta = (i / PHYSICS.rimSegments) * Math.PI * 2;
      const x = hoop.rimCenter.x + Math.cos(theta) * COURT.rimRadius;
      const z = hoop.rimCenter.z + Math.sin(theta) * COURT.rimRadius;

      const segmentBody = new CANNON.Body({ mass: 0, material: materials.rim });
      segmentBody.addShape(new CANNON.Cylinder(PHYSICS.rimSegmentRadius, PHYSICS.rimSegmentRadius, segmentLength, 8));
      segmentBody.position.set(x, hoop.rimCenter.y, z);
      segmentBody.quaternion.setFromEuler(0, -theta, 0); // rodar para ser tangente ao círculo
      segmentBody.kind = "rim";
      segmentBody.hoopId = hoop.id; // identifica a qual cesto pertence (para o som e rede)
      world.addBody(segmentBody);
      rimBodies.push(segmentBody);
    }
  });

  function createBallBody(initialPosition) {
    const ballBody = new CANNON.Body({
      mass: BALL.mass,
      material: materials.ball,
      linearDamping: BALL.linearDamping,
      angularDamping: BALL.angularDamping,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.8,
    });
    ballBody.addShape(new CANNON.Sphere(BALL.radius));
    ballBody.kind = "ball";
    world.addBody(ballBody);
    setBallBodyKinematic(ballBody, initialPosition);
    return ballBody;
  }

  // Modo kinematic: bola controlada pelo código (dribble) — física desligada
  function setBallBodyKinematic(ballBody, position) {
    ballBody.type = CANNON.Body.KINEMATIC;
    ballBody.mass = 0;
    ballBody.updateMassProperties();
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    setBodyPosition(ballBody, position);
    ballBody.quaternion.set(0, 0, 0, 1);
    ballBody.aabbNeedsUpdate = true;
  }

  // Modo dynamic: bola passa a ser simulada pela física (lançamento, passe)
  function activateBallBody(ballBody, velocity, position) {
    ballBody.type = CANNON.Body.DYNAMIC;
    ballBody.mass = BALL.mass;
    ballBody.updateMassProperties();
    setBodyPosition(ballBody, position);
    ballBody.velocity.set(velocity.x, velocity.y, velocity.z); // velocidade inicial do lançamento
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.wakeUp(); // acordar se estava a "dormir" por inactividade
  }

  return {
    world,
    rimBodies,
    createBallBody,
    setBallBodyKinematic,
    activateBallBody,
  };
}
